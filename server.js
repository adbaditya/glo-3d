const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();

// Configure Helmet with custom CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        frameAncestors: ["'self'", "https://*.hubspot.com", "https://app.hubspot.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        connectSrc: ["'self'", "https:", "http:"],
      },
    },
    frameguard: false, // Disable frameguard as we'll set it manually
  })
);

// Custom middleware for frame-ancestors
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://*.hubspot.com https://app.hubspot.com"
  );
  next();
});

// CORS configuration
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'https://app.hubspot.com',
      'https://glo-3d.vercel.app',
      /\.hubspot\.com$/
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if the origin is allowed
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return allowedOrigin === origin;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.static(path.join(__dirname, 'public')));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Cache implementation
class Cache {
  constructor(ttlMillis = 3600000) { // 1 hour default TTL
    this.cache = new Map();
    this.ttl = ttlMillis;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  set(key, value) {
    const expiry = Date.now() + this.ttl;
    this.cache.set(key, { value, expiry });
  }

  clear() {
    this.cache.clear();
  }
}

// Initialize cache
const inventoryCache = new Cache();

// Constants
const GLO3D_API_URL = 'https://us-central1-glo3d-c338b.cloudfunctions.net/outbound/api/v1/inventory';

// Configure axios instance
const glo3dApi = axios.create({
  baseURL: GLO3D_API_URL,
  headers: {
    'Authorization': `Basic ${Buffer.from(`${process.env.GLO3D_USERNAME}:${process.env.GLO3D_PASSWORD}`).toString('base64')}`,
    'Content-Type': 'application/json'
  }
});

// Helper function to fetch inventory data
async function fetchInventoryData(filters) {
  const cacheKey = JSON.stringify(filters);
  const cachedData = inventoryCache.get(cacheKey);
  
  if (cachedData) {
    console.log('Serving from cache');
    return cachedData;
  }

  console.log('Fetching fresh data');
  const response = await glo3dApi.post('?=application/json&', {}, {
    params: filters
  });
  
  const data = response.data;
  inventoryCache.set(cacheKey, data);
  return data;
}

// Main route
app.get('/', async (req, res) => {
  try {
    const filters = {
      make: req.query.make,
      model: req.query.model,
      year: req.query.year,
      location: req.query.location
    };

    const data = await fetchInventoryData({});
    let inventory = data.data || [];

    // Apply filters client-side
    inventory = inventory.filter(item => {
      const fields = item.fields || {};
      return (!filters.make || fields.make === filters.make) &&
             (!filters.model || fields.model === filters.model) &&
             (!filters.year || fields.year === filters.year) &&
             (!filters.location || fields.location === filters.location);
    });

    // Get unique values for filters
    const makes = [...new Set(data.data.map(item => item.fields?.make).filter(Boolean))];
    const models = [...new Set(data.data.map(item => item.fields?.model).filter(Boolean))];
    const years = [...new Set(data.data.map(item => item.fields?.year).filter(Boolean))];
    const locations = [...new Set(data.data.map(item => item.fields?.location).filter(Boolean))];

    res.render('index', {
      inventory: inventory,
      filters: { makes, models, years, locations },
      selectedFilters: filters
    });
  } catch (error) {
    console.error('Error:', error);
    res.render('index', {
      inventory: [],
      filters: { makes: [], models: [], years: [], locations: [] },
      selectedFilters: {},
      error: 'Failed to load inventory'
    });
  }
});

// API route for AJAX requests
app.get('/api/inventory', async (req, res) => {
  try {
    const filters = {
      make: req.query.make,
      model: req.query.model,
      year: req.query.year
    };

    const data = await fetchInventoryData(filters);
    res.json(data);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/inventory-table', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const search = req.query.search || '';
    const filters = {
      make: req.query.make,
      model: req.query.model,
      year: req.query.year
    };

    const data = await fetchInventoryData(filters);
    let inventory = data.data || [];

    // Apply search filter if search term exists
    if (search) {
      inventory = inventory.filter(item => {
        const searchString = `${item.fields?.make} ${item.fields?.model} ${item.fields?.vin} ${item.fields?.year} ${item.fields?.trim} ${item.fields?.location} ${item.fields?.stockNumber}`.toLowerCase();
        return searchString.includes(search.toLowerCase());
      });
    }

    // Calculate pagination
    const totalItems = inventory.length;
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedInventory = inventory.slice(startIndex, endIndex);

    res.render('inventory-table', {
      inventory: paginatedInventory,
      pagination: {
        current: page,
        total: totalPages,
        limit,
        baseUrl: '/inventory-table'
      },
      search,
      selectedFilters: filters
    });
  } catch (error) {
    console.error('Error:', error);
    res.render('inventory-table', {
      inventory: [],
      pagination: {
        current: 1,
        total: 1,
        limit: 25,
        baseUrl: '/inventory-table'
      },
      search: '',
      selectedFilters: {},
      error: 'Failed to load inventory'
    });
  }
});

app.post('/api/clear-cache', (req, res) => {
  inventoryCache.clear();
  res.json({ success: true, message: 'Cache cleared successfully' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});