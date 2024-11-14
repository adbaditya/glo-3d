const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();

// Comprehensive CORS configuration
app.use(cors({
  origin: ['https://app.hubspot.com', 'https://glo-3d.vercel.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Set additional security headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', true);
  
  // Handle OPTIONS method
  if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Middleware
app.use(cors());
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

// Main route
app.get('/main-grid', async (req, res) => {
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
    // Fetch all inventory data from the API
    const data = await fetchInventoryData({});

    // Extract filters from the request query
    const filters = {
      make: req.query.make,
      model: req.query.model,
      year: req.query.year,
      location: req.query.location,
      price_sort: req.query.price_sort,
      price_range: req.query.price_range
    };

    console.log('Received filters:', filters);

    // Filter the inventory data based on the received filters
    let filteredInventory = data.data || [];
    filteredInventory = filteredInventory.filter(item => {
      const fields = item.fields || {};
      const price = parseFloat(fields.price) || 0;

      // Apply make, model, year, and location filters
      return (!filters.make || fields.make === filters.make) &&
             (!filters.model || fields.model === filters.model) &&
             (!filters.year || fields.year === filters.year) &&
             (!filters.location || fields.location === filters.location) &&
             isInPriceRange(price, filters.price_range);
    });

    // Sort the filtered data by price if specified
    if (filters.price_sort) {
      filteredInventory.sort((a, b) => {
        const priceA = parseFloat(a.fields.price) || 0;
        const priceB = parseFloat(b.fields.price) || 0;
        return filters.price_sort === 'asc' ? priceA - priceB : priceB - priceA;
      });
    }

    console.log('Filtered data count:', filteredInventory.length);

    // Send the filtered data as a response
    res.json(filteredInventory);

  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function isInPriceRange(price, range) {
  if (!range) return true;

  switch (range) {
    case '0-15000':
      return price <= 15000;
    case '15000-30000':
      return price > 15000 && price <= 30000;
    case '30000-50000':
      return price > 30000 && price <= 50000;
    case '50000+':
      return price > 50000;
    default:
      return true;
  }
}

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