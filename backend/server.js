// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ----- Environment checks -----
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const ROUTE_API_KEY = process.env.ROUTE_API_KEY;
const HF_API_KEY = process.env.HF_API_KEY; // reserved if used later
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

if (!WEATHER_API_KEY) {
  console.warn('⚠️  WARNING: WEATHER_API_KEY is not set. Weather routes will fail until you set it in .env');
}
if (!JWT_SECRET || JWT_SECRET === 'your-secret-key-change-in-production') {
  console.warn('⚠️  WARNING: Using default JWT secret. Replace with a secure value in production.');
}

// ----- MongoDB Connection -----
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/skycast-mega';
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err.message));

// ----- Models -----
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const TripSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  destination: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  itinerary: [{ 
    day: Number,
    date: String,
    activities: [{ 
      time: String, 
      activity: String, 
      location: String,
      notes: String 
    }]
  }],
  packingList: [{ item: String, packed: Boolean }],
  accommodation: { name: String, address: String, checkIn: String, checkOut: String },
  restaurants: [{ name: String, cuisine: String, location: String }],
  events: [{ name: String, date: String, location: String }],
  createdAt: { type: Date, default: Date.now }
});

const WeatherHistorySchema = new mongoose.Schema({
  location: String,
  date: Date,
  temperature: Number,
  conditions: String,
  precipitation: Number
});

const User = mongoose.model('User', UserSchema);
const Trip = mongoose.model('Trip', TripSchema);
const WeatherHistory = mongoose.model('WeatherHistory', WeatherHistorySchema);

// ----- Constants -----
const WEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const ROUTE_BASE_URL = 'https://api.openrouteservice.org';

// ----- Helpers -----
const getWeatherIcon = (icon = '') => {
  // map by first two chars of OpenWeather icon (e.g., "01d", "10n")
  const code = icon.substring(0, 2);
  const map = {
    "01": "sun",
    "02": "cloud-sun",
    "03": "cloud",
    "04": "cloud",
    "09": "cloud-rain",
    "10": "cloud-rain",
    "11": "cloud-lightning",
    "13": "cloud-snow",
    "50": "cloud-fog"
  };
  return map[code] || "cloud";
};

// ----- Auth Middleware -----
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    if (!token) return res.status(401).json({ error: 'No token provided' });

    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ---------------- AUTH ROUTES ----------------
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields required' });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Signup error:', error.message);
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error.message);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ---------------- WEATHER ROUTES ----------------
app.get('/api/weather/coords', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon query params are required' });
    if (!WEATHER_API_KEY) return res.status(500).json({ error: 'WEATHER_API_KEY not configured' });

    // get current weather
    const currentResponse = await axios.get(
      `${WEATHER_BASE_URL}/weather`, {
        params: { lat, lon, appid: WEATHER_API_KEY, units: 'metric' }
      }
    );

    // get forecast
    const forecastResponse = await axios.get(
      `${WEATHER_BASE_URL}/forecast`, {
        params: { lat, lon, appid: WEATHER_API_KEY, units: 'metric' }
      }
    );

    // optional: air quality (may fail on free tier)
    let airQualityResponse = null;
    try {
      airQualityResponse = await axios.get(
        `${WEATHER_BASE_URL}/air_pollution`, {
          params: { lat, lon, appid: WEATHER_API_KEY }
        }
      );
    } catch (err) {
      // silently continue; not critical
      airQualityResponse = null;
    }

    const currentData = currentResponse.data;
    const current = {
      temp: Math.round(currentData.main.temp),
      feels_like: Math.round(currentData.main.feels_like),
      humidity: currentData.main.humidity,
      wind_speed: currentData.wind?.speed || 0,
      pressure: currentData.main.pressure,
      description: currentData.weather?.[0]?.description || '',
      icon: getWeatherIcon(currentData.weather?.[0]?.icon || ''),
      location: `${currentData.name || 'Unknown'}, ${currentData.sys?.country || ''}`,
      uv_index: null, // placeholder; OpenWeather free tier doesn't include uv
      air_quality: airQualityResponse?.data?.list?.[0]?.main?.aqi || null
    };

    // build per-day forecast (group by date)
    const dailyForecasts = {};
    forecastResponse.data.list.forEach(item => {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toDateString();
      if (!dailyForecasts[dateKey]) {
        dailyForecasts[dateKey] = {
          temps: [],
          humidity: [],
          description: item.weather?.[0]?.description || '',
          icon: getWeatherIcon(item.weather?.[0]?.icon || '')
        };
      }
      dailyForecasts[dateKey].temps.push(item.main.temp);
      dailyForecasts[dateKey].humidity.push(item.main.humidity);
    });

    const forecast = Object.keys(dailyForecasts).slice(0, 7).map(dateKey => {
      const dayData = dailyForecasts[dateKey];
      const date = new Date(dateKey);
      return {
        date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        temp_max: Math.round(Math.max(...dayData.temps)),
        temp_min: Math.round(Math.min(...dayData.temps)),
        description: dayData.description,
        icon: dayData.icon,
        humidity: Math.round(dayData.humidity.reduce((a, b) => a + b, 0) / dayData.humidity.length)
      };
    });

    // Save to history (best-effort; don't block response)
    try {
      await WeatherHistory.create({
        location: current.location,
        date: new Date(),
        temperature: current.temp,
        conditions: current.description,
        precipitation: currentData.rain?.['1h'] || 0
      });
    } catch (err) {
      console.warn('WeatherHistory save failed:', err.message);
    }

    res.json({ current, forecast, coords: { lat, lon } });
  } catch (error) {
    console.error('Weather API Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

app.get('/api/weather/location', async (req, res) => {
  try {
    const { location } = req.query;
    if (!location) return res.status(400).json({ error: 'location query param is required' });
    if (!WEATHER_API_KEY) return res.status(500).json({ error: 'WEATHER_API_KEY not configured' });

    const geoResponse = await axios.get(`${WEATHER_BASE_URL}/weather`, {
      params: { q: location, appid: WEATHER_API_KEY, units: 'metric' }
    });

    const lat = geoResponse.data.coord.lat;
    const lon = geoResponse.data.coord.lon;

    const forecastResponse = await axios.get(`${WEATHER_BASE_URL}/forecast`, {
      params: { lat, lon, appid: WEATHER_API_KEY, units: 'metric' }
    });

    let airQualityResponse = null;
    try {
      airQualityResponse = await axios.get(`${WEATHER_BASE_URL}/air_pollution`, {
        params: { lat, lon, appid: WEATHER_API_KEY }
      });
    } catch (err) {
      airQualityResponse = null;
    }

    const current = {
      temp: Math.round(geoResponse.data.main.temp),
      feels_like: Math.round(geoResponse.data.main.feels_like),
      humidity: geoResponse.data.main.humidity,
      wind_speed: geoResponse.data.wind?.speed || 0,
      pressure: geoResponse.data.main.pressure,
      description: geoResponse.data.weather?.[0]?.description || '',
      icon: getWeatherIcon(geoResponse.data.weather?.[0]?.icon || ''),
      location: `${geoResponse.data.name || location}, ${geoResponse.data.sys?.country || ''}`,
      uv_index: null,
      air_quality: airQualityResponse?.data?.list?.[0]?.main?.aqi || null
    };

    const dailyForecasts = {};
    forecastResponse.data.list.forEach(item => {
      const date = new Date(item.dt * 1000);
      const dateKey = date.toDateString();
      if (!dailyForecasts[dateKey]) {
        dailyForecasts[dateKey] = {
          temps: [],
          humidity: [],
          description: item.weather?.[0]?.description || '',
          icon: getWeatherIcon(item.weather?.[0]?.icon || '')
        };
      }
      dailyForecasts[dateKey].temps.push(item.main.temp);
      dailyForecasts[dateKey].humidity.push(item.main.humidity);
    });

    const forecast = Object.keys(dailyForecasts).slice(0, 7).map(dateKey => {
      const dayData = dailyForecasts[dateKey];
      const date = new Date(dateKey);
      return {
        date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        temp_max: Math.round(Math.max(...dayData.temps)),
        temp_min: Math.round(Math.min(...dayData.temps)),
        description: dayData.description,
        icon: dayData.icon,
        humidity: Math.round(dayData.humidity.reduce((a, b) => a + b, 0) / dayData.humidity.length)
      };
    });

    // Optionally save history here as well (best-effort)
    try {
      await WeatherHistory.create({
        location: current.location,
        date: new Date(),
        temperature: current.temp,
        conditions: current.description,
        precipitation: geoResponse.data.rain?.['1h'] || 0
      });
    } catch (err) {
      console.warn('WeatherHistory save failed:', err.message);
    }

    res.json({ current, forecast, coords: { lat, lon } });
  } catch (error) {
    console.error('Weather Location API Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Location not found' });
  }
});

// ----- Weather history -----
app.get('/api/weather/history', async (req, res) => {
  try {
    const { location = '', days = 30 } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));

    const history = await WeatherHistory.find({
      location: new RegExp(location, 'i'),
      date: { $gte: daysAgo }
    }).sort({ date: -1 }).limit(100);

    res.json({ history });
  } catch (error) {
    console.error('Weather history error:', error.message);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ---------------- ROUTE (OpenRouteService) ----------------
app.get('/api/route', async (req, res) => {
  try {
    const { source, destination, sourceLat, sourceLon } = req.query;
    if (!destination) return res.status(400).json({ error: 'destination is required' });
    if (!WEATHER_API_KEY) return res.status(500).json({ error: 'WEATHER_API_KEY not configured' });
    if (!ROUTE_API_KEY) return res.status(500).json({ error: 'ROUTE_API_KEY not configured' });

    let sourceCoords = null;
    if (sourceLat && sourceLon) {
      sourceCoords = { lat: parseFloat(sourceLat), lon: parseFloat(sourceLon) };
    } else if (source) {
      const sourceGeo = await axios.get(`${WEATHER_BASE_URL}/weather`, {
        params: { q: source, appid: WEATHER_API_KEY }
      });
      sourceCoords = { lat: sourceGeo.data.coord.lat, lon: sourceGeo.data.coord.lon };
    } else {
      return res.status(400).json({ error: 'Either source or sourceLat & sourceLon must be provided' });
    }

    const destGeo = await axios.get(`${WEATHER_BASE_URL}/weather`, {
      params: { q: destination, appid: WEATHER_API_KEY }
    });
    const destCoords = { lat: destGeo.data.coord.lat, lon: destGeo.data.coord.lon };

    const routeResponse = await axios.post(
      `${ROUTE_BASE_URL}/v2/directions/driving-car`,
      {
        coordinates: [[sourceCoords.lon, sourceCoords.lat], [destCoords.lon, destCoords.lat]]
      },
      {
        headers: {
          'Authorization': ROUTE_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const route = routeResponse.data.routes[0];
    res.json({
      coordinates: route.geometry.coordinates,
      distance: `${(route.summary.distance / 1000).toFixed(2)} km`,
      duration: `${Math.round(route.summary.duration / 60)} minutes`,
      source: sourceCoords,
      destination: destCoords
    });
  } catch (error) {
    console.error('Route API Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to calculate route' });
  }
});

// ---------------- AI & PACKING ----------------
app.post('/api/ai/packing-list', async (req, res) => {
  try {
    const { destination, startDate, endDate, weather } = req.body;
    if (!destination || !startDate || !endDate) {
      return res.status(400).json({ error: 'destination, startDate and endDate are required' });
    }

    const days = Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)));
    const temp = weather?.temp ?? 25;
    const isRainy = (weather?.description || '').toLowerCase().includes('rain');
    const isCold = temp < 15;
    const isHot = temp > 30;

    const packingList = [
      // Clothing
      { category: 'Clothing', item: `${days + 2} Underwear`, packed: false },
      { category: 'Clothing', item: `${days} Pairs of socks`, packed: false },
      { category: 'Clothing', item: isCold ? 'Warm jacket' : isHot ? 'Light jacket' : 'Medium jacket', packed: false },
      { category: 'Clothing', item: `${Math.ceil(days / 2)} Pants/jeans`, packed: false },
      { category: 'Clothing', item: `${days} Shirts/tops`, packed: false },
      ...(isHot ? [{ category: 'Clothing', item: 'Shorts', packed: false }, { category: 'Clothing', item: 'Sunglasses', packed: false }] : []),
      ...(isCold ? [{ category: 'Clothing', item: 'Gloves', packed: false }, { category: 'Clothing', item: 'Scarf', packed: false }] : []),
      ...(isRainy ? [{ category: 'Clothing', item: 'Raincoat', packed: false }, { category: 'Clothing', item: 'Umbrella', packed: false }] : []),
      // Toiletries
      { category: 'Toiletries', item: 'Toothbrush & toothpaste', packed: false },
      { category: 'Toiletries', item: 'Shampoo & conditioner', packed: false },
      { category: 'Toiletries', item: 'Deodorant', packed: false },
      { category: 'Toiletries', item: 'Sunscreen (SPF 50+)', packed: false },
      { category: 'Toiletries', item: 'Medications', packed: false },
      // Electronics
      { category: 'Electronics', item: 'Phone charger', packed: false },
      { category: 'Electronics', item: 'Power bank', packed: false },
      { category: 'Electronics', item: 'Universal adapter', packed: false },
      { category: 'Electronics', item: 'Camera', packed: false },
      // Documents
      { category: 'Documents', item: 'Passport/ID', packed: false },
      { category: 'Documents', item: 'Travel tickets', packed: false },
      { category: 'Documents', item: 'Hotel confirmations', packed: false },
      { category: 'Documents', item: 'Travel insurance', packed: false },
      // Essentials
      { category: 'Essentials', item: 'Wallet & cards', packed: false },
      { category: 'Essentials', item: 'Cash (local currency)', packed: false },
      { category: 'Essentials', item: 'Hand sanitizer', packed: false },
      { category: 'Essentials', item: 'Face masks', packed: false },
      { category: 'Essentials', item: 'Water bottle', packed: false }
    ];

    res.json({ packingList, weatherInfo: { temp, isRainy, isCold, isHot } });
  } catch (error) {
    console.error('Packing list error:', error.message);
    res.status(500).json({ error: 'Failed to generate packing list' });
  }
});

app.post('/api/ai/suggest', async (req, res) => {
  try {
    const { destination, startDate, endDate, weather } = req.body;
    const suggestions = generateFallbackSuggestions(destination, weather);
    res.json({ suggestions });
  } catch (error) {
    console.error('AI suggest error:', error.message);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

function generateFallbackSuggestions(destination = 'your destination', weather = '') {
  const isGoodWeather = !(weather || '').toLowerCase().includes('rain');
  return [
    {
      title: isGoodWeather ? '🏞️ Outdoor Exploration' : '🏛️ Indoor Attractions',
      description: isGoodWeather 
        ? `Perfect ${weather} weather for exploring ${destination}'s natural beauty.` 
        : `Visit museums and indoor attractions in ${destination}.`,
      time: 'Morning to Afternoon',
      weatherSuitability: 'Ideal'
    },
    {
      title: '🍽️ Local Cuisine Tour',
      description: `Discover authentic restaurants in ${destination}.`,
      time: 'Lunch/Dinner',
      weatherSuitability: 'Perfect'
    },
    {
      title: isGoodWeather ? '📸 Photography Walk' : '☕ Cozy Café Hopping',
      description: isGoodWeather ? `Capture stunning photos around ${destination}.` : `Explore local cafés in ${destination}.`,
      time: 'Flexible',
      weatherSuitability: 'Excellent'
    },
    {
      title: '🛍️ Shopping & Markets',
      description: `Browse local markets in ${destination}.`,
      time: 'Afternoon',
      weatherSuitability: 'Good'
    }
  ];
}

// ---------------- AI CHATBOT ----------------



// To this (optional auth - allow both authenticated and guest users):
app.post('/api/ai/chat', async (req, res) => {
  try {
    // Optional authentication - extract userId if token exists
    let userId = null;
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
      if (token && token !== 'guest') {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId;
      }
    } catch (err) {
      // Guest user - continue without userId
    }

    const { message, context } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    // Rest of your existing chatbot logic...
    let response = '';
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('weather') || lowerMessage.includes('temperature')) {
      response = `I can help you check the weather! Go to the Weather tab and enter your destination. ${context?.weather ? `Currently it's ${context.weather.temp}°C in ${context.weather.location}.` : ''}`;
    } else if (lowerMessage.includes('pack') || lowerMessage.includes('bring')) {
      response = `I can generate a packing list for you! Use the Trip Planner tab and I'll suggest items based on your destination's weather.`;
    } else if (lowerMessage.includes('route') || lowerMessage.includes('how to get')) {
      response = `I can help you plan your route! Go to the Maps tab and enter your source and destination.`;
    } else if (lowerMessage.includes('activity') || lowerMessage.includes('things to do') || lowerMessage.includes('do')) {
      response = `Looking for things to do? Use the Trip Planner's AI suggest feature to get weather-based activity recommendations!`;
    } else if (lowerMessage.includes('hotel') || lowerMessage.includes('accommodation')) {
      response = `I can help you find accommodations! Check the Itinerary tab where you can search for hotels near your destination.`;
    } else if (lowerMessage.includes('hi') || lowerMessage.includes('hello') || lowerMessage.includes('hey')) {
      response = `Hey there! I'm your travel assistant. I can help with weather, routes, packing lists and suggestions. What would you like to do?`;
    } else {
      response = `I'm your travel assistant! I can help you with:
- Weather forecasts
- Route planning
- Packing lists
- Activity suggestions
- Accommodation finding

What would you like to know?`;
    }

    res.json({ response, userId }); 
  } catch (error) {
    console.error('Chat failed:', error.message);
    res.status(500).json({ error: 'Chat failed' });
  }
});

// ---------------- TRIP MANAGEMENT ----------------
app.post('/api/trips', authMiddleware, async (req, res) => {
  try {
    const tripData = { ...req.body, userId: req.userId };
    const trip = new Trip(tripData);
    await trip.save();
    res.json({ trip });
  } catch (error) {
    console.error('Create trip error:', error.message);
    res.status(500).json({ error: 'Failed to create trip' });
  }
});

app.get('/api/trips', authMiddleware, async (req, res) => {
  try {
    const trips = await Trip.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ trips });
  } catch (error) {
    console.error('Fetch trips error:', error.message);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

app.get('/api/trips/:id', authMiddleware, async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, userId: req.userId });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json({ trip });
  } catch (error) {
    console.error('Fetch trip error:', error.message);
    res.status(500).json({ error: 'Failed to fetch trip' });
  }
});

app.put('/api/trips/:id', authMiddleware, async (req, res) => {
  try {
    const trip = await Trip.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    );
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json({ trip });
  } catch (error) {
    console.error('Update trip error:', error.message);
    res.status(500).json({ error: 'Failed to update trip' });
  }
});

app.delete('/api/trips/:id', authMiddleware, async (req, res) => {
  try {
    const trip = await Trip.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    res.json({ message: 'Trip deleted' });
  } catch (error) {
    console.error('Delete trip error:', error.message);
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

// ---------------- PLACES (mocked) ----------------
app.get('/api/places/accommodation', async (req, res) => {
  try {
    const { location = 'Unknown' } = req.query;
    const accommodations = [
      {
        name: `Grand Hotel ${location}`,
        address: `123 Main St, ${location}`,
        rating: 4.5,
        price: '$120/night',
        amenities: ['WiFi', 'Pool', 'Breakfast'],
        image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400'
      },
      {
        name: `Budget Inn ${location}`,
        address: `456 Side St, ${location}`,
        rating: 3.8,
        price: '$65/night',
        amenities: ['WiFi', 'Parking'],
        image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400'
      },
      {
        name: `Luxury Resort ${location}`,
        address: `789 Beach Rd, ${location}`,
        rating: 4.9,
        price: '$280/night',
        amenities: ['WiFi', 'Pool', 'Spa', 'Restaurant', 'Gym'],
        image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=400'
      }
    ];
    res.json({ accommodations });
  } catch (error) {
    console.error('Accommodations error:', error.message);
    res.status(500).json({ error: 'Failed to fetch accommodations' });
  }
});

app.get('/api/places/restaurants', async (req, res) => {
  try {
    const { location = 'Unknown' } = req.query;
    const restaurants = [
      {
        name: `Local Flavors`,
        cuisine: 'Traditional',
        rating: 4.6,
        priceRange: '$$',
        address: `101 Food St, ${location}`,
        image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400'
      },
      {
        name: `Seafood Paradise`,
        cuisine: 'Seafood',
        rating: 4.8,
        priceRange: '$$$',
        address: `202 Harbor View, ${location}`,
        image: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400'
      },
      {
        name: `Street Food Corner`,
        cuisine: 'Street Food',
        rating: 4.3,
        priceRange: '$',
        address: `303 Market Square, ${location}`,
        image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400'
      }
    ];
    res.json({ restaurants });
  } catch (error) {
    console.error('Restaurants error:', error.message);
    res.status(500).json({ error: 'Failed to fetch restaurants' });
  }
});

app.get('/api/places/events', async (req, res) => {
  try {
    const { location = 'Unknown', date } = req.query;
    const events = [
      {
        name: `${location} Music Festival`,
        date: '2025-02-15',
        time: '18:00',
        location: `Central Park, ${location}`,
        category: 'Music',
        price: '$35',
        image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400'
      },
      {
        name: `Food & Wine Expo`,
        date: '2025-02-20',
        time: '12:00',
        location: `Convention Center, ${location}`,
        category: 'Food',
        price: 'Free',
        image: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=400'
      },
      {
        name: `Art Gallery Opening`,
        date: '2025-02-18',
        time: '19:00',
        location: `Downtown Gallery, ${location}`,
        category: 'Art',
        price: '$15',
        image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=400'
      }
    ];
    res.json({ events });
  } catch (error) {
    console.error('Events error:', error.message);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'SkyCast Mega API is running',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SkyCast Mega API running on port ${PORT}`);
  console.log(`📍 Health: http://localhost:${PORT}/api/health`);
});
