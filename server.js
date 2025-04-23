const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

//const cookieParser = require('cookie-parser');
//const jwt = require('jsonwebtoken');
//const { requireAuth, getRandomExpiry } = require('./auth');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
//app.use(cookieParser());

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
    console.log('Clearing cache');
    this.cache.clear();
    console.log('Cache cleared, size:', this.cache.size);
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
    console.log('Serving from cache:', {
      dataLength: cachedData.data?.length,
    });
    return cachedData;
  }

  console.log('Making fresh API call');
  const [gloResponse, vinData] = await Promise.all([
    glo3dApi.post('', {
      offset: 0,
      limit: 1000,
      captureType: "all",
      responseType: "all",
      privacy: "public",
      ...filters
    }),
    fetchVinStatuses()
  ]);

  console.log('GLO3D API Response:', {
    total: gloResponse.data.total,
    pageSize: gloResponse.data.pageSize,
    remaining: gloResponse.data.remaining,
    dataLength: gloResponse.data.data?.length
  });

  const data = gloResponse.data;

  if (data.data) {
    data.data = data.data
      .filter(item => vinData[item.vin])
      .map(item => {
        const customerUrl = item.src;
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
            atLocation: filters.location ? [filters.location] : [],
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

  console.log('Processed data length:', data.data.length);
  inventoryCache.set(cacheKey, data);
  return data;
}

// Login endpoint
/*app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    if (username === process.env.MASTER_USERNAME &&
      password === process.env.MASTER_PASSWORD) {

      const expiry = getRandomExpiry();
      const token = jwt.sign(
        { username },
        process.env.JWT_SECRET,
        { expiresIn: expiry }
      );

      res.cookie('authToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: expiry
      });

      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});*/

// Auth check endpoint
/*app.get('/api/check-auth', (req, res) => {
  try {
    const token = req.cookies.authToken;
    
    if (!token) {
      return res.json({ authenticated: false });
    }
    
    jwt.verify(token, process.env.JWT_SECRET);
    res.json({ authenticated: true });
  } catch (err) {
    console.error('Auth check error:', err);
    res.clearCookie('authToken');
    res.json({ authenticated: false });
  }
});*/

// Logout endpoint
/*app.post('/api/logout', (req, res) => {
  res.clearCookie('authToken');
  res.json({ success: true });
});*/

// Main route
app.get('/', async (req, res) => {
  try {
    // First get the data
    const data = await fetchInventoryData({});
    let inventory = data.data || [];

    //console.log('Selected location:', req.query.location);

    // Before filtering
    console.log('Total inventory before filtering:', inventory.length);

    /*console.log('Sample items before filtering:', inventory.slice(0, 2).map(item => ({
      vin: item.vin,
      location: item.atLocation,
      rawLocation: item.atLocation // Log raw location data
    })));*/

    const statusOrder = [
      'AVAILABLE',
      'DEAL PENDING',
      'SIGNED DEAL',
      'PENDING DELIVERY',
      'ON DELIVERY',
      'DELIVERED',
      'IN FUNDING',
      'BOOKED | NOT DELIVERED',
      'BOOKED | DELIVERED',
      'CHASE',
      'DO NOT SELL',
      'VOID | IN STOCK',
      'VOID | OUTSOURCED',
      'WHOLESALE',
      'Unknown'
    ];

    inventory.sort((a, b) => {
      const statusA = a.status || 'Unknown';
      const statusB = b.status || 'Unknown';
      return statusOrder.indexOf(statusA) - statusOrder.indexOf(statusB);
    });

    if (req.query.location && req.query.location !== 'undefined' && req.query.location !== '') {
      console.log('Filtering by location:', req.query.location);
      inventory = inventory.filter(item => {
        const itemLocations = Array.isArray(item.atLocation) ? item.atLocation : [item.atLocation];
        const queryLocation = req.query.location.toUpperCase();
        
        console.log(`VIN ${item.vin}:`, {
          locations: itemLocations,
          query: queryLocation
        });
        
        return itemLocations.some(loc => loc && loc.toUpperCase() === queryLocation);
      });
    }

    // After filtering
    //console.log('Inventory after location filtering:', inventory.length);

    /*console.log('Sample filtered items:', inventory.slice(0, 2).map(item => ({
      vin: item.vin,
      location: item.atLocation
    })));*/

    if (!inventory.length) {
      throw new Error('No inventory data available');
    }

    // Process the filters here, before rendering
    const processedFilters = {
      makes: [],
      models: [],
      years: [],
      locations: [],
      vehicleTypes: [],
      statuses: []
    };

    // Process each inventory item to build filters
    inventory.forEach(item => {
      if (item.atMake) processedFilters.makes.push(item.atMake);
      if (item.atModel) processedFilters.models.push(item.atModel);
      if (item.atYear) processedFilters.years.push(item.atYear);
      if (item.atLocation) {
        const location = Array.isArray(item.atLocation) ? item.atLocation[0] : item.atLocation;
        if (location) processedFilters.locations.push(location);
      }
      if (item.atType) processedFilters.vehicleTypes.push(item.atType);
      if (item.status) processedFilters.statuses.push(item.status);
    });

    // Remove duplicates and sort
    const filters = {
      makes: [...new Set(processedFilters.makes)].sort(),
      models: [...new Set(processedFilters.models)].sort(),
      years: [...new Set(processedFilters.years)].sort().reverse(),
      years: [...new Set(processedFilters.years)].sort().reverse(),
      locations: [...new Set(inventory
        .map(item => Array.isArray(item.atLocation) ? item.atLocation[0] : item.atLocation)
        .filter(Boolean))].sort(),
      vehicleTypes: [...new Set(processedFilters.vehicleTypes)].sort(),
      statuses: [...new Set(processedFilters.statuses)].sort()
    };

    // Debug log right before rendering
    //console.log('Final processed filters:', filters);

    // Only render once with the complete data
    return res.render('index', {
      inventory: inventory,
      filters: filters,
      selectedFilters: req.query || {},
      error: null
    });

  } catch (error) {
    console.error('Error in main route:', error);
    // Render with empty data in case of error
    return res.render('index', {
      inventory: [],
      filters: {
        makes: [],
        models: [],
        years: [],
        locations: [],
        vehicleTypes: [],
        statuses: []
      },
      selectedFilters: {},
      error: 'Failed to load inventory'
    });
  }
});

app.get('/car/:vin', async (req, res) => {
  try {
    const { vin } = req.params;
    const data = await fetchInventoryData({});
    const car = data.data.find(item => item.vin === vin);

    if (!car) {
      return res.status(404).send('Car not found');
    }

    res.render('car-details', { car });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Server error');
  }
});

// Add this route before your main route

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

app.all('/api/clear-cache', (req, res) => {
  console.log('Clearing cache...');
  inventoryCache.clear();
  res.json({ success: true, message: 'Cache cleared successfully' });
});

app.get('/api/inventory/search', async (req, res) => {
  try {
    const { make, model, year, status, location, price_sort, price_range, search, vehicle_type } = req.query;
    console.log('Query params:', req.query);

    const data = await fetchInventoryData({});
    let inventory = data.data || [];

    inventory = inventory.filter(item => {
      // Location filter
      if (location) {
        const cleanLocation = location.toUpperCase();
        const itemLocations = Array.isArray(item.atLocation) ? item.atLocation : [item.atLocation];
        if (!itemLocations.some(loc => loc && loc.toString().toUpperCase() === cleanLocation)) {
          return false;
        }
      }

      // Other filters
      const basicFilters = (!make || item.atMake === make) &&
        (!model || item.atModel === model) &&
        (!year || item.atYear === year) &&
        (!status || item.status === status) &&
        (!vehicle_type || item.atType === vehicle_type);

      // Price range filter
      let priceFilter = true;
      if (price_range) {
        const cost = parseFloat(item.atCost) || 0;
        switch (price_range) {
          case '0-20000': priceFilter = cost <= 20000; break;
          case '20000-30000': priceFilter = cost > 20000 && cost <= 30000; break;
          case '30000-50000': priceFilter = cost > 30000 && cost <= 50000; break;
          case '50000+': priceFilter = cost > 50000; break;
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
    const records = await base('SINGLE INVENTORY').select({
      fields: ['VIN.', 'STATUS', 'YEAR', 'MAKE', 'MODEL', 'TRIMLINE', 'STOCK LOCATION.', 'CARFAX LINK', 'KM', 'COLOUR', 'COST.', 'PURCHASE PROVINCE', 'DRIVE', 'SEATS', 'TYPE', 'DECS $', 'ON SITE', 'INSPECTED', 'DETAILED', 'NEW PICS', 'AFC']
    }).all();
    records.forEach(record => {
      const vin = record.get('VIN.');
      const status = record.get('STATUS');
      if (vin) {
        vinData[vin] = {
          status: (record.get('STATUS') || [])[0] || 'Unknown',
          atYear: record.get('YEAR'),
          atMake: record.get('MAKE'),
          atModel: record.get('MODEL'),
          atTrimline: record.get('TRIMLINE'),
          atCarfax: record.get('CARFAX LINK'),
          atKM: record.get('KM'),
          atColor: record.get('COLOUR'),
          atCost: record.get('COST.'),
          atLocation: Array.isArray(record.get('STOCK LOCATION.')) ?
            record.get('STOCK LOCATION.') :
            [record.get('STOCK LOCATION.')].filter(Boolean),
          atDrive: record.get('DRIVE'),
          atSeats: record.get('SEATS'),
          atType: record.get('TYPE'),
          atDeclaration: record.get('DECS $'),
          atOnSite: record.get('ON SITE'),
          atInspection: record.get('INSPECTED'),
          atDetailed: record.get('DETAILED'),
          atNewPics: record.get('NEW PICS'),
          atAFC: record.get('AFC')
        };
      }
    });
    //console.log(vinData);
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