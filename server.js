const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();

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
  const [gloResponse, vinData] = await Promise.all([
    glo3dApi.post('?=application/json&', {}, { params: filters }),
    fetchVinStatuses()
  ]);

  const data = gloResponse.data;
  if (data.data) {
    data.data = data.data
      .filter(item => vinData[item.vin])
      .map(item => {
        const customerUrl = item.src ? item.src.replace('/iframeNova/', '/') : item.src;

        return {
          ...item,
          customerUrl,
          ...(vinData[item.vin] || {
            status: 'Unknown',
            atYear: '',
            atMake: '',
            atModel: '',
            atTrimline: '',
            atCarfax: '',
            atKM: '',
            atColor: '',
            atCost: '',
            atLocation: '',
            atDrive: '',
            atSeats: '',
            atType: '',
            atDeclaration: '',
            atOnSite: '',
            atInspection: '',
            atDetailed: '',
            atNewPics: '',
            atCarMedia: '',
            atAFC: ''
          })
        };
      });
  }

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
      location: req.query.location,
      vehicle_type: req.query.vehicle_type,
      status: req.query.status
    };

    const data = await fetchInventoryData({});
    let inventory = data.data || [];

    inventory = inventory.map(item => {
      const customerUrl = item.src ? item.src.replace('/iframeNova/', '/') : item.src;
      return {
        ...item,
        customerUrl
      };
    });

    // Apply filters client-side
    inventory = inventory.filter(item => {
      const fields = item.fields || {};
      return (!filters.make || fields.make === filters.make) &&
        (!filters.model || fields.model === filters.model) &&
        (!filters.year || fields.year === filters.year) &&
        (!filters.location || fields.location === filters.location) &&
        (!filters.vehicle_type || fields['1731653551051'] === filters.vehicle_type) &&
        (!filters.status || item.status === filters.status);
    });

    // Get unique values for filters
    const makes = [...new Set(data.data.map(item => item.atMake).filter(Boolean))];
    const models = [...new Set(data.data.map(item => item.atModel).filter(Boolean))];
    const years = [...new Set(data.data.map(item => item.atYear).filter(Boolean))];
    const locations = [...new Set(data.data.map(item => item.atLocation).filter(Boolean))];
    const vehicleTypes = [...new Set(data.data.map(item => item.atType).filter(Boolean))];
    const statuses = [...new Set(data.data.map(item => item.status).filter(Boolean))];

    res.render('index', {
      inventory: inventory,
      filters: { makes, models, years, locations, vehicleTypes, statuses },
      selectedFilters: filters
    });
  } catch (error) {
    console.error('Error:', error);
    res.render('index', {
      inventory: [],
      filters: { makes: [], models: [], years: [], locations: [], vehicleTypes: [] },
      selectedFilters: {},
      error: 'Failed to load inventory'
    });
  }
});

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

app.get('/api/inventory/search', async (req, res) => {
  try {
    const {
      make,
      model,
      year,
      status,
      location,
      price_sort,
      price_range,
      search,
      vehicle_type,
      limit = 25
    } = req.query;

    const data = await fetchInventoryData({});
    let inventory = data.data || [];

    // Apply filters using Airtable fields
    inventory = inventory.filter(item => {
      // Basic field filters
      const basicFilters = (!make || item.atMake === make) &&
        (!model || item.atModel === model) &&
        (!year || item.atYear === year) &&
        (!location || item.atLocation === location) &&
        (!status || item.status === status) &&
        (!vehicle_type || item.atType === vehicle_type);

      // Price range filter using atCost
      let priceFilter = true;
      if (price_range) {
        const cost = parseFloat(item.atCost) || 0;
        switch (price_range) {
          case '0-20000':
            priceFilter = cost <= 20000;
            break;
          case '20000-30000':
            priceFilter = cost > 20000 && cost <= 30000;
            break;
          case '30000-50000':
            priceFilter = cost > 30000 && cost <= 50000;
            break;
          case '50000+':
            priceFilter = cost > 50000;
            break;
        }
      }

      // Search filter
      let searchFilter = true;
      if (search) {
        const searchString = `${item.atMake} ${item.atModel} ${item.vin} ${item.atYear} ${item.atTrimline} ${item.atLocation}`.toLowerCase();
        searchFilter = searchString.includes(search.toLowerCase());
      }

      return basicFilters && priceFilter && searchFilter;
    });

    // Apply price sorting using atCost
    if (price_sort) {
      inventory.sort((a, b) => {
        const costA = parseFloat(a.atCost) || 0;
        const costB = parseFloat(b.atCost) || 0;
        return price_sort === 'asc' ? costA - costB : costB - costA;
      });
    }

    res.json(inventory);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inventory/car/:vin', async (req, res) => {
  try {
    const { vin } = req.params;
    const data = await fetchInventoryData({});
    const car = data.data.find(item => item.vin === vin);

    if (!car) {
      return res.status(404).json({ error: 'Car not found' });
    }

    res.json(car);
  } catch (error) {
    console.error('Error fetching car details:', error);
    res.status(500).json({ error: error.message });
  }
});

const Airtable = require('airtable');
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Cache for Airtable data
const statusCache = new Cache();

// Function to fetch status data from Airtable
async function fetchVinStatuses() {
  const cacheKey = 'vinStatuses';
  const cached = statusCache.get(cacheKey);
  if (cached) return cached;

  const vinData = {};
  try {
    const records = await base('VINSync').select({
      fields: ['VIN', 'STATUS', 'Year', 'Make', 'Model', 'Trimline', 'Carfax URL', 'KM', 'Color', 'Cost', 'Location', 'Drive', 'Seats', 'Type', 'Declaration', 'OnSite', 'Inspection', 'Detailed', 'New Pics', 'Car Media', 'AFC']
    }).all();
    records.forEach(record => {
      const vin = record.get('VIN');
      const status = record.get('STATUS');
      if (vin) {
        vinData[vin] = {
          status: record.get('STATUS'),
          atYear: record.get('Year'),
          atMake: record.get('Make'),
          atModel: record.get('Model'),
          atTrimline: record.get('Trimline'),
          atCarfax: record.get('Carfax URL'),
          atKM: record.get('KM'),
          atColor: record.get('Color'),
          atCost: record.get('Cost'),
          atLocation: record.get('Location'),
          atDrive: record.get('Drive'),
          atSeats: record.get('Seats'),
          atType: record.get('Type'),
          atDeclaration: record.get('Declaration'),
          atOnSite: record.get('OnSite'),
          atInspection: record.get('Inspection'),
          atDetailed: record.get('Detailed'),
          atNewPics: record.get('New Pics'),
          atCarMedia: record.get('Car Media'),
          atAFC: record.get('AFC')
        };
      }
    });
    statusCache.set(cacheKey, vinData);
    return vinData;
  } catch (error) {
    console.error('Airtable fetch error:', error);
    return {};
  }
}

app.post('/api/send-sms', async (req, res) => {
  try {
    const { phoneNumber, tourUrl } = req.body;
    
    const record = await base('SMSLinks').create([
      {
        fields: {
          'Phone Number': phoneNumber,
          'Tour URL': tourUrl,
          'Date Sent': new Date().toISOString()
        }
      }
    ]);

    res.json({ success: true, message: 'SMS record created successfully' });
  } catch (error) {
    console.error('Error creating SMS record:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});