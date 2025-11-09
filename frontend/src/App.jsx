import React, { useState, useEffect, useRef } from 'react';
import { 
  Cloud, MapPin, Navigation, Calendar, Sparkles, Route, Search, Loader, 
  Sun, CloudRain, Wind, Droplets, Gauge, AlertCircle, User, LogOut, Save, 
  Plus, Mic, MessageCircle, Send, X, Hotel, UtensilsCrossed, Calendar as CalendarIcon, 
  Package, Check, Clock, Shield 
} from 'lucide-react';

const App = () => {
  const [activeTab, setActiveTab] = useState('weather');
  const [location, setLocation] = useState('');
  const [currentWeather, setCurrentWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [coords, setCoords] = useState(null);
  
  // Auth states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authData, setAuthData] = useState({ name: '', email: '', password: '' });
  const [showHomePage, setShowHomePage] = useState(true);
  
  // Token state (fixes stale closure)
  const [token, setToken] = useState(localStorage.getItem('token'));
  
  // Map states
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [mapView, setMapView] = useState('location');
  const mapRef = useRef(null);
  const [routeData, setRouteData] = useState(null);
  
  // Trip states
  const [trips, setTrips] = useState([]);
  const [currentTrip, setCurrentTrip] = useState(null);
  const [tripDestination, setTripDestination] = useState('');
  const [tripDates, setTripDates] = useState({ start: '', end: '' });
  
  // Itinerary states
  const [itinerary, setItinerary] = useState([]);
  const [packingList, setPackingList] = useState([]);
  const [accommodations, setAccommodations] = useState([]);
  const [restaurants, setRestaurants] = useState([]);
  const [events, setEvents] = useState([]);
  
  // AI Chatbot states
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  
  // Voice command states
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  
  // Weather history
  const [weatherHistory, setWeatherHistory] = useState([]);
  
  // Health & Safety
  const [healthSafety, setHealthSafety] = useState(null);

  const API_BASE = 'http://localhost:3001/api';

  // Load token & verify on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    setToken(storedToken);

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      setVoiceSupported(true);
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCoords({ lat: latitude, lon: longitude });
          fetchWeatherByCoords(latitude, longitude);
        },
        () => {
          setLocation('Chennai');
        }
      );
    }

    if (storedToken) {
      verifyToken(storedToken);
    }
  }, []);

  // Initialize map when tab changes
 useEffect(() => {
  if (activeTab === 'map' && coords) {
    // Small delay to ensure DOM is rendered
    const timer = setTimeout(() => {
      initMap();
    }, 100);
    return () => clearTimeout(timer);
  }
}, [activeTab, coords]);
  const verifyToken = async (currentToken) => {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      const data = await response.json();
      if (data.user) {
        setUser(data.user);
        setIsAuthenticated(true);
        setShowHomePage(false); // Hide landing if already logged in
        loadUserTrips(currentToken);
      }
    } catch (error) {
      localStorage.removeItem('token');
      setToken(null);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/signup';
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authData)
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      const newToken = data.token;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(data.user);
      setIsAuthenticated(true);
      setShowHomePage(false); // Hide landing page
      setAuthData({ name: '', email: '', password: '' });
      setShowAuth(false);
      loadUserTrips(newToken);
    } catch (error) {
      setError('Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setTrips([]);
    setShowHomePage(true); // Show landing on logout
  };

  const loadUserTrips = async (currentToken) => {
    try {
      const response = await fetch(`${API_BASE}/trips`, {
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });
      const data = await response.json();
      if (data.trips) setTrips(data.trips);
    } catch (error) {
      console.error('Failed to load trips');
    }
  };

const initMap = () => {
  // Wait for Leaflet + DOM
  if (!window.L || !document.getElementById('map') || !coords) {
    console.warn('Map not ready:', { L: !!window.L, map: !!document.getElementById('map'), coords });
    return;
  }

  // Clear existing map
  if (mapRef.current) {
    mapRef.current.remove();
  }

  const map = window.L.map('map').setView([coords.lat, coords.lon], 13);

  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  window.L.marker([coords.lat, coords.lon])
    .addTo(map)
    .bindPopup('You are here!')
    .openPopup();

  mapRef.current = map;
};

  const fetchWeatherByCoords = async (lat, lon) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/weather/coords?lat=${lat}&lon=${lon}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setCurrentWeather(data.current);
      setForecast(data.forecast);
      setLocation(data.current.location);

      setHealthSafety({
        uvIndex: data.current.uv_index,
        airQuality: data.current.air_quality,
        alerts: []
      });
    } catch (error) {
      setError('Failed to fetch weather');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSearch = async () => {
    if (!location.trim()) return;

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/weather/location?location=${encodeURIComponent(location)}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setCurrentWeather(data.current);
      setForecast(data.forecast);
      setCoords({ lat: data.coords.lat, lon: data.coords.lon });

      setHealthSafety({
        uvIndex: data.current.uv_index,
        airQuality: data.current.air_quality,
        alerts: []
      });

      loadWeatherHistory(location);
    } catch (error) {
      setError('Failed to fetch weather');
    } finally {
      setLoading(false);
    }
  };

  const loadWeatherHistory = async (loc) => {
    try {
      const response = await fetch(`${API_BASE}/weather/history?location=${encodeURIComponent(loc)}&days=30`);
      const data = await response.json();
      if (data.history) setWeatherHistory(data.history);
    } catch (error) {
      console.error('Failed to load history');
    }
  };

  const handleRouteSearch = async () => {
    if (!source.trim() || !destination.trim()) {
      setError('Please enter both source and destination');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const sourceCoords = coords || { lat: 13.0827, lon: 80.2707 };
      const response = await fetch(`${API_BASE}/route?source=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}&sourceLat=${sourceCoords.lat}&sourceLon=${sourceCoords.lon}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setRouteData(data);
      drawRoute(data);
    } catch (error) {
      setError('Failed to fetch route');
    } finally {
      setLoading(false);
    }
  };

  const drawRoute = (data) => {
    if (!mapRef.current || !window.L) return;

    mapRef.current.eachLayer((layer) => {
      if (layer instanceof window.L.Polyline || layer instanceof window.L.Marker) {
        mapRef.current.removeLayer(layer);
      }
    });

    const points = data.coordinates.map(coord => [coord[1], coord[0]]);
    window.L.polyline(points, { color: 'blue', weight: 4 }).addTo(mapRef.current);

    window.L.marker(points[0]).addTo(mapRef.current).bindPopup(source);
    window.L.marker(points[points.length - 1]).addTo(mapRef.current).bindPopup(destination);

    mapRef.current.fitBounds(points);
  };

  const generatePackingList = async () => {
    if (!tripDestination.trim()) {
      setError('Please enter a destination');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/ai/packing-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: tripDestination,
          startDate: tripDates.start,
          endDate: tripDates.end,
          weather: currentWeather
        })
      });

      const data = await response.json();
      if (data.packingList) setPackingList(data.packingList);
    } catch (error) {
      setError('Failed to generate packing list');
    } finally {
      setLoading(false);
    }
  };

  const loadAccommodations = async () => {
    try {
      const response = await fetch(`${API_BASE}/places/accommodation?location=${encodeURIComponent(tripDestination)}`);
      const data = await response.json();
      if (data.accommodations) setAccommodations(data.accommodations);
    } catch (error) {
      console.error('Failed to load accommodations');
    }
  };

  const loadRestaurants = async () => {
    try {
      const response = await fetch(`${API_BASE}/places/restaurants?location=${encodeURIComponent(tripDestination)}`);
      const data = await response.json();
      if (data.restaurants) setRestaurants(data.restaurants);
    } catch (error) {
      console.error('Failed to load restaurants');
    }
  };

  const loadEvents = async () => {
    try {
      const response = await fetch(`${API_BASE}/places/events?location=${encodeURIComponent(tripDestination)}`);
      const data = await response.json();
      if (data.events) setEvents(data.events);
    } catch (error) {
      console.error('Failed to load events');
    }
  };

  const saveTrip = async () => {
    if (!isAuthenticated) {
      setError('Please login to save trips');
      setShowAuth(true);
      return;
    }

    try {
      const tripData = {
        destination: tripDestination,
        startDate: tripDates.start,
        endDate: tripDates.end,
        itinerary,
        packingList
      };

      const response = await fetch(`${API_BASE}/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(tripData)
      });

      const data = await response.json();
      if (data.trip) {
        setTrips([data.trip, ...trips]);
        alert('Trip saved successfully!');
      }
    } catch (error) {
      setError('Failed to save trip');
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;

    const userMessage = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || 'guest'}`
        },
        body: JSON.stringify({
          message: chatInput,
          context: { weather: currentWeather }
        })
      });

      const data = await response.json();
      const botMessage = { role: 'assistant', content: data.response || 'Sorry, I could not process that.' };
      setChatMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage = { role: 'assistant', content: 'Sorry, I encountered an error.' };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  };

  const startVoiceCommand = () => {
    if (!voiceSupported) {
      alert('Voice commands not supported in this browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();

      if (transcript.includes('weather')) {
        setActiveTab('weather');
        const cityMatch = transcript.match(/in ([a-z\s]+)/);
        if (cityMatch) {
          setLocation(cityMatch[1]);
          handleLocationSearch();
        }
      } else if (transcript.includes('map') || transcript.includes('route')) {
        setActiveTab('map');
      } else if (transcript.includes('trip') || transcript.includes('plan')) {
        setActiveTab('itinerary');
      }
    };

    recognition.start();
  };

  const togglePackingItem = (index) => {
    const updated = [...packingList];
    updated[index].packed = !updated[index].packed;
    setPackingList(updated);
  };

  const addItineraryDay = () => {
    const dayNum = itinerary.length + 1;
    const startDate = new Date(tripDates.start);
    const dayDate = new Date(startDate);
    dayDate.setDate(startDate.getDate() + dayNum - 1);

    setItinerary([...itinerary, {
      day: dayNum,
      date: dayDate.toLocaleDateString(),
      activities: []
    }]);
  };

  const addActivity = (dayIndex) => {
    const updated = [...itinerary];
    updated[dayIndex].activities.push({
      time: '09:00',
      activity: '',
      location: '',
      notes: ''
    });
    setItinerary(updated);
  };

  const updateActivity = (dayIndex, actIndex, field, value) => {
    const updated = [...itinerary];
    updated[dayIndex].activities[actIndex][field] = value;
    setItinerary(updated);
  };

  const getWeatherIcon = (iconName) => {
    const icons = {
      'sun': <Sun className="w-16 h-16 text-yellow-400" />,
      'cloud': <Cloud className="w-16 h-16 text-gray-400" />,
      'cloud-rain': <CloudRain className="w-16 h-16 text-blue-400" />
    };
    return icons[iconName] || icons['cloud'];
  };

  const getAirQualityLabel = (aqi) => {
    const labels = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];
    return labels[aqi - 1] || 'Unknown';
  };

  const getAirQualityColor = (aqi) => {
    const colors = ['bg-green-100 text-green-700', 'bg-yellow-100 text-yellow-700', 'bg-orange-100 text-orange-700', 'bg-red-100 text-red-700', 'bg-purple-100 text-purple-700'];
    return colors[aqi - 1] || 'bg-gray-100 text-gray-700';
  };

  const getUVLabel = (uv) => {
    if (uv <= 2) return 'Low';
    if (uv <= 5) return 'Moderate';
    if (uv <= 7) return 'High';
    if (uv <= 10) return 'Very High';
    return 'Extreme';
  };

  const getUVColor = (uv) => {
    if (uv <= 2) return 'bg-green-100 text-green-700';
    if (uv <= 5) return 'bg-yellow-100 text-yellow-700';
    if (uv <= 7) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  // === RENDER FUNCTIONS ===
  const renderHomePage = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-600 to-pink-600 flex items-center justify-center p-6">
      <div className="max-w-6xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-7xl font-bold text-white mb-4 drop-shadow-lg">
            SkyCast Mega
          </h1>
          <p className="text-2xl text-white/90 mb-2">Your Ultimate Travel Companion</p>
          <p className="text-lg text-white/75">Weather Forecasts • Smart Maps • Trip Planning • AI Assistant</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-white hover:bg-white/20 transition-all">
            <Cloud className="w-12 h-12 mb-4 mx-auto" />
            <h3 className="text-xl font-bold mb-2 text-center">Real-Time Weather</h3>
            <p className="text-white/80 text-center text-sm">Get accurate weather forecasts, UV index, air quality, and 7-day predictions</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-white hover:bg-white/20 transition-all">
            <Navigation className="w-12 h-12 mb-4 mx-auto" />
            <h3 className="text-xl font-bold mb-2 text-center">Smart Navigation</h3>
            <p className="text-white/80 text-center text-sm">Plan routes, explore maps, and get real-time directions for your journey</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-white hover:bg-white/20 transition-all">
            <CalendarIcon className="w-12 h-12 mb-4 mx-auto" />
            <h3 className="text-xl font-bold mb-2 text-center">Trip Planning</h3>
            <p className="text-white/80 text-center text-sm">Create itineraries, get packing lists, find hotels, restaurants, and events</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-white hover:bg-white/20 transition-all">
            <MessageCircle className="w-12 h-12 mb-4 mx-auto" />
            <h3 className="text-xl font-bold mb-2 text-center">AI Travel Assistant</h3>
            <p className="text-white/80 text-center text-sm">Chat with our AI to get personalized travel recommendations</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-white hover:bg-white/20 transition-all">
            <Shield className="w-12 h-12 mb-4 mx-auto" />
            <h3 className="text-xl font-bold mb-2 text-center">Health & Safety</h3>
            <p className="text-white/80 text-center text-sm">Monitor UV levels, air quality, and get weather alerts</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 text-white hover:bg-white/20 transition-all">
            <Mic className="w-12 h-12 mb-4 mx-auto" />
            <h3 className="text-xl font-bold mb-2 text-center">Voice Commands</h3>
            <p className="text-white/80 text-center text-sm">Control the app with your voice for hands-free experience</p>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={() => {
              setAuthMode('login');
              setShowAuth(true);
            }}
            className="px-12 py-4 bg-white text-purple-600 rounded-2xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all"
          >
            Login
          </button>
          <button
            onClick={() => {
              setAuthMode('signup');
              setShowAuth(true);
            }}
            className="px-12 py-4 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-2xl font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all"
          >
            Sign Up Free
          </button>
        </div>

        <p className="text-center text-white/60 mt-8 text-sm">
          Join thousands of travelers using SkyCast Mega for smarter journeys
        </p>
      </div>
    </div>
  );

  const renderAuthModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">{authMode === 'login' ? 'Login' : 'Sign Up'}</h2>
          <button onClick={() => setShowAuth(false)} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-4">
          {authMode === 'signup' && (
            <input
              type="text"
              placeholder="Name"
              value={authData.name}
              onChange={(e) => setAuthData({...authData, name: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={authData.email}
            onChange={(e) => setAuthData({...authData, email: e.target.value})}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={authData.password}
            onChange={(e) => setAuthData({...authData, password: e.target.value})}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            required
          />
          
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-700 text-sm">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : authMode === 'login' ? 'Login' : 'Sign Up'}
          </button>
        </form>
        
        <p className="text-center mt-4 text-gray-600">
          {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
          <button
            onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
            className="text-blue-600 font-semibold"
          >
            {authMode === 'login' ? 'Sign Up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );

  const renderChatbot = () => (
    <div className={`fixed bottom-6 right-6 z-40 transition-all ${showChatbot ? 'w-96 h-[500px]' : 'w-16 h-16'}`}>
      {!showChatbot ? (
        <button
          onClick={() => setShowChatbot(true)}
          className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        >
          <MessageCircle className="w-8 h-8" />
        </button>
      ) : (
        <div className="bg-white rounded-2xl shadow-2xl flex flex-col h-full">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 rounded-t-2xl flex justify-between items-center">
            <h3 className="font-bold">AI Travel Assistant</h3>
            <button onClick={() => setShowChatbot(false)} className="text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center text-gray-500 mt-8">
                <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>Ask me anything about your trip!</p>
              </div>
            )}
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 p-3 rounded-2xl">
                  <Loader className="w-5 h-5 animate-spin" />
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Type your question..."
                className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={sendChatMessage}
                className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderWeatherTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Enter location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLocationSearch()}
              className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={handleLocationSearch}
            disabled={loading}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
          </button>
          {voiceSupported && (
            <button
              onClick={startVoiceCommand}
              className={`px-6 py-3 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              <Mic className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {currentWeather && (
        <>
          <div className="bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 rounded-3xl shadow-2xl p-8 text-white">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-4xl font-bold mb-2">{currentWeather.temp}°C</h2>
                <p className="text-xl opacity-90">{currentWeather.description}</p>
                <p className="text-sm opacity-75 mt-1">Feels like {currentWeather.feels_like}°C</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
                {getWeatherIcon(currentWeather.icon)}
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mt-8">
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4">
                <Droplets className="w-5 h-5 mb-2 opacity-75" />
                <p className="text-sm opacity-75">Humidity</p>
                <p className="text-xl font-semibold">{currentWeather.humidity}%</p>
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4">
                <Wind className="w-5 h-5 mb-2 opacity-75" />
                <p className="text-sm opacity-75">Wind</p>
                <p className="text-xl font-semibold">{currentWeather.wind_speed} m/s</p>
              </div>
              <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4">
                <Gauge className="w-5 h-5 mb-2 opacity-75" />
                <p className="text-sm opacity-75">Pressure</p>
                <p className="text-xl font-semibold">{currentWeather.pressure} hPa</p>
              </div>
            </div>
          </div>

          {healthSafety && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-600" />
                Health & Safety
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border-2 border-gray-100 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-2">UV Index</p>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{healthSafety.uvIndex}</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getUVColor(healthSafety.uvIndex)}`}>
                      {getUVLabel(healthSafety.uvIndex)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {healthSafety.uvIndex > 5 ? 'Wear sunscreen' : 'Sun protection recommended'}
                  </p>
                </div>
                <div className="border-2 border-gray-100 rounded-xl p-4">
                  <p className="text-sm text-gray-600 mb-2">Air Quality</p>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{healthSafety.airQuality}</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getAirQualityColor(healthSafety.airQuality)}`}>
                      {getAirQualityLabel(healthSafety.airQuality)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {healthSafety.airQuality > 3 ? 'Limited outdoor activities' : 'Good for outdoor activities'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-2xl font-bold mb-6 text-gray-800">7-Day Forecast</h3>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
              {forecast.map((day, idx) => (
                <div key={idx} className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 text-center hover:shadow-lg transition-all">
                  <p className="font-semibold text-gray-700 mb-2">{day.date}</p>
                  <div className="flex justify-center my-3">
                    {getWeatherIcon(day.icon)}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{day.description}</p>
                  <div className="flex justify-center gap-2 text-sm">
                    <span className="font-bold text-gray-800">{day.temp_max}°</span>
                    <span className="text-gray-500">{day.temp_min}°</span>
                  </div>
                  <p className="text-xs text-blue-600 mt-2">Humidity {day.humidity}%</p>
                </div>
              ))}
            </div>
          </div>

          {weatherHistory.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Clock className="w-6 h-6 text-purple-600" />
                Weather History (Last 30 Days)
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {weatherHistory.slice(0, 10).map((record, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold">{new Date(record.date).toLocaleDateString()}</p>
                      <p className="text-sm text-gray-600">{record.conditions}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{record.temperature}°C</p>
                      <p className="text-xs text-gray-500">{record.precipitation}mm rain</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderMapTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMapView('location')}
            className={`px-4 py-2 rounded-lg transition-all ${mapView === 'location' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <MapPin className="w-4 h-4 inline mr-2" />
            Live Location
          </button>
          <button
            onClick={() => setMapView('route')}
            className={`px-4 py-2 rounded-lg transition-all ${mapView === 'route' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <Route className="w-4 h-4 inline mr-2" />
            Route Planner
          </button>
        </div>

        {mapView === 'route' && (
          <div className="space-y-4 mb-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="relative">
                <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Source location"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <button
              onClick={handleRouteSearch}
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Finding Route...' : 'Find Route'}
            </button>
          </div>
        )}

        {error && mapView === 'route' && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div id="map" className="rounded-xl h-96 bg-gray-200"></div>

        {routeData && (
          <div className="mt-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4">
            <h4 className="font-semibold text-gray-800 mb-2">Route Information</h4>
            <p className="text-gray-700">Distance: {routeData.distance}</p>
            <p className="text-gray-700">Duration: {routeData.duration}</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderItineraryTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Trip Itinerary Builder</h2>
          {isAuthenticated && (
            <button
              onClick={saveTrip}
              className="px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Trip
            </button>
          )}
        </div>
        
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Destination"
              value={tripDestination}
              onChange={(e) => setTripDestination(e.target.value)}
              className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>
          <input
            type="date"
            value={tripDates.start}
            onChange={(e) => setTripDates({ ...tripDates, start: e.target.value })}
            className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
          />
          <input
            type="date"
            value={tripDates.end}
            onChange={(e) => setTripDates({ ...tripDates, end: e.target.value })}
            className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              generatePackingList();
              loadAccommodations();
              loadRestaurants();
              loadEvents();
            }}
            className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-xl transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            Generate Travel Plan
          </button>
        </div>
      </div>

      {packingList.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Package className="w-6 h-6 text-purple-600" />
            Smart Packing List
          </h3>
          <div className="space-y-3">
            {Object.entries(packingList.reduce((acc, item) => {
              if (!acc[item.category]) acc[item.category] = [];
              acc[item.category].push(item);
              return acc;
            }, {})).map(([category, items]) => (
              <div key={category} className="border-2 border-gray-100 rounded-xl p-4">
                <h4 className="font-semibold text-gray-800 mb-3">{category}</h4>
                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const globalIdx = packingList.indexOf(item);
                    return (
                      <label key={globalIdx} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-all">
                        <input
                          type="checkbox"
                          checked={item.packed}
                          onChange={() => togglePackingItem(globalIdx)}
                          className="w-5 h-5 text-blue-600"
                        />
                        <span className={item.packed ? 'line-through text-gray-400' : 'text-gray-700'}>
                          {item.item}
                        </span>
                        {item.packed && <Check className="w-4 h-4 text-green-500 ml-auto" />}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {accommodations.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Hotel className="w-6 h-6 text-blue-600" />
            Recommended Accommodations
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            {accommodations.map((hotel, idx) => (
              <div key={idx} className="border-2 border-gray-100 rounded-xl overflow-hidden hover:shadow-lg transition-all">
                <img src={hotel.image || '/api/placeholder/400/300'} alt={hotel.name} className="w-full h-40 object-cover" />
                <div className="p-4">
                  <h4 className="font-bold text-gray-800 mb-1">{hotel.name}</h4>
                  <p className="text-sm text-gray-600 mb-2">{hotel.address}</p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-yellow-500">{'⭐'.repeat(Math.floor(hotel.rating))}</span>
                    <span className="font-bold text-blue-600">{hotel.price}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {hotel.amenities?.map((amenity, i) => (
                      <span key={i} className="text-xs bg-gray-100 px-2 py-1 rounded">{amenity}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {restaurants.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-orange-600" />
            Top Restaurants
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            {restaurants.map((restaurant, idx) => (
              <div key={idx} className="border-2 border-gray-100 rounded-xl overflow-hidden hover:shadow-lg transition-all">
                <img src={restaurant.image || '/api/placeholder/400/300'} alt={restaurant.name} className="w-full h-40 object-cover" />
                <div className="p-4">
                  <h4 className="font-bold text-gray-800 mb-1">{restaurant.name}</h4>
                  <p className="text-sm text-gray-600 mb-2">{restaurant.cuisine}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-yellow-500">{'⭐'.repeat(Math.floor(restaurant.rating))}</span>
                    <span className="text-green-600 font-semibold">{restaurant.priceRange}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{restaurant.address}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {events.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-purple-600" />
            Local Events
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            {events.map((event, idx) => (
              <div key={idx} className="border-2 border-gray-100 rounded-xl overflow-hidden hover:shadow-lg transition-all">
                <img src={event.image || '/api/placeholder/400/300'} alt={event.name} className="w-full h-40 object-cover" />
                <div className="p-4">
                  <h4 className="font-bold text-gray-800 mb-2">{event.name}</h4>
                  <p className="text-sm text-gray-600 mb-1">Date: {event.date} at {event.time}</p>
                  <p className="text-sm text-gray-600 mb-2">Location: {event.location}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">{event.category}</span>
                    <span className="font-bold text-green-600">{event.price}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Day-by-Day Itinerary</h3>
          <button
            onClick={addItineraryDay}
            className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Day
          </button>
        </div>
        
        {itinerary.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No itinerary yet. Click "Add Day" to start planning!</p>
        ) : (
          <div className="space-y-4">
            {itinerary.map((day, dayIdx) => (
              <div key={dayIdx} className="border-2 border-gray-200 rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-lg">Day {day.day} - {day.date}</h4>
                  <button
                    onClick={() => addActivity(dayIdx)}
                    className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-all"
                  >
                    + Activity
                  </button>
                </div>
                
                <div className="space-y-3">
                  {day.activities.map((activity, actIdx) => (
                    <div key={actIdx} className="bg-gray-50 rounded-lg p-3 grid md:grid-cols-4 gap-2">
                      <input
                        type="time"
                        value={activity.time}
                        onChange={(e) => updateActivity(dayIdx, actIdx, 'time', e.target.value)}
                        className="px-3 py-2 border rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Activity"
                        value={activity.activity}
                        onChange={(e) => updateActivity(dayIdx, actIdx, 'activity', e.target.value)}
                        className="px-3 py-2 border rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Location"
                        value={activity.location}
                        onChange={(e) => updateActivity(dayIdx, actIdx, 'location', e.target.value)}
                        className="px-3 py-2 border rounded-lg"
                      />
                      <input
                        type="text"
                        placeholder="Notes"
                        value={activity.notes}
                        onChange={(e) => updateActivity(dayIdx, actIdx, 'notes', e.target.value)}
                        className="px-3 py-2 border rounded-lg"
                      />
                    </div>
                  ))}
              </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {trips.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-xl font-bold mb-4">My Saved Trips</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {trips.map((trip, idx) => (
              <div key={idx} className="border-2 border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all">
                <h4 className="font-bold text-lg mb-2">{trip.destination}</h4>
                <p className="text-sm text-gray-600 mb-2">
                  {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                </p>
                <button
                  onClick={() => setCurrentTrip(trip)}
                  className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all text-sm"
                >
                  View Details
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {showHomePage ? (
        renderHomePage()
      ) : (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div className="text-center flex-1">
                <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                  SkyCast Mega
                </h1>
                <p className="text-gray-600 text-lg">Weather • Maps • Travel Planning • AI Assistant</p>
              </div>
              
              <div className="flex items-center gap-3">
                {isAuthenticated ? (
                  <>
                    <div className="text-right mr-3">
                      <p className="font-semibold text-gray-800">{user?.name}</p>
                     
                    </div>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowAuth(true)}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:shadow-lg transition-all flex items-center gap-2"
                  >
                    <User className="w-5 h-5" />
                    Login / Sign Up
                  </button>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-2 mb-8 flex gap-2">
              <button
                onClick={() => setActiveTab('weather')}
                className={`flex-1 py-4 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold ${
                  activeTab === 'weather' 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Cloud className="w-5 h-5" />
                Weather
              </button>
              <button
                onClick={() => setActiveTab('map')}
                className={`flex-1 py-4 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold ${
                  activeTab === 'map' 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Navigation className="w-5 h-5" />
                Maps
              </button>
              <button
                onClick={() => setActiveTab('itinerary')}
                className={`flex-1 py-4 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold ${
                  activeTab === 'itinerary' 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <CalendarIcon className="w-5 h-5" />
                Trip Planner
              </button>
            </div>

            {activeTab === 'weather' && renderWeatherTab()}
            {activeTab === 'map' && renderMapTab()}
            {activeTab === 'itinerary' && renderItineraryTab()}
          </div>

          {renderChatbot()}
        </div>
      )}

      {showAuth && renderAuthModal()}
    </>
  );
};

export default App;