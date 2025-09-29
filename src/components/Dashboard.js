import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Calendar, Activity, AlertTriangle } from 'lucide-react';

const Dashboard = () => {
  const [data, setData] = useState([]);
  const [rawData, setRawData] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('confirmed');
  const [selectedCountry, setSelectedCountry] = useState('Global');
  const [showForecast, setShowForecast] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load and process real CSV data
  useEffect(() => {
    const loadRealData = async () => {
      try {
        // Try to load real data first
        const response = await fetch('/data/covid_19_clean_complete.csv');
        if (response.ok) {
          const csvText = await response.text();
          const processedData = parseCSVData(csvText);
          setRawData(processedData);
          setData(processGlobalData(processedData));
          setLoading(false);
        } else {
          throw new Error('CSV file not found');
        }
      } catch (err) {
        console.log('Real data not found, using simulated data');
        // Fallback to simulated data
        const simulatedData = generateCovidData();
        setRawData(simulatedData);
        setData(simulatedData);
        setLoading(false);
      }
    };

    loadRealData();
  }, []);

  // Parse CSV data
  const parseCSVData = (csvText) => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    
    const data = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.replace(/"/g, '').trim());
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      return row;
    });

    return data.map(row => ({
      date: new Date(row['Date'] || row['date']).toISOString().split('T')[0],
      country: row['Country/Region'] || row['country'] || 'Unknown',
      province: row['Province/State'] || row['province'] || '',
      confirmed: parseInt(row['Confirmed'] || row['confirmed'] || 0),
      deaths: parseInt(row['Deaths'] || row['deaths'] || 0),
      recovered: parseInt(row['Recovered'] || row['recovered'] || 0),
      active: parseInt(row['Active'] || row['active'] || 0)
    })).filter(row => !isNaN(row.confirmed));
  };

  // Process global data (sum all countries by date)
  const processGlobalData = (rawData) => {
    const globalData = {};
    
    rawData.forEach(row => {
      const date = row.date;
      if (!globalData[date]) {
        globalData[date] = {
          date: date,
          confirmed: 0,
          deaths: 0,
          recovered: 0,
          active: 0
        };
      }
      
      globalData[date].confirmed += row.confirmed;
      globalData[date].deaths += row.deaths;
      globalData[date].recovered += row.recovered;
      globalData[date].active += row.active;
    });

    return Object.values(globalData)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((item, index) => ({
        ...item,
        week: `Week ${Math.floor(index / 7) + 1}`
      }));
  };

  // Process country-specific data
  const processCountryData = (rawData, country) => {
    return rawData
      .filter(row => row.country === country)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((item, index) => ({
        ...item,
        week: `Week ${Math.floor(index / 7) + 1}`
      }));
  };

  // Get unique countries
  const getCountries = () => {
    const countries = [...new Set(rawData.map(row => row.country))];
    return ['Global', ...countries.sort()];
  };

  // Handle country selection
  const handleCountryChange = (country) => {
    setSelectedCountry(country);
    if (country === 'Global') {
      setData(processGlobalData(rawData));
    } else {
      setData(processCountryData(rawData, country));
    }
  };

  // Fallback simulated data (same as before)
  const generateCovidData = () => {
    const data = [];
    const startDate = new Date('2020-01-22');
    
    for (let i = 0; i < 100; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i * 7);
      
      const baseConfirmed = Math.floor(1000 + i * 150 + Math.random() * 500);
      const baseDeaths = Math.floor(baseConfirmed * 0.02 + Math.random() * 10);
      const baseRecovered = Math.floor(baseConfirmed * 0.85 + Math.random() * 100);
      
      data.push({
        date: date.toISOString().split('T')[0],
        confirmed: baseConfirmed,
        deaths: baseDeaths,
        recovered: baseRecovered,
        active: baseConfirmed - baseDeaths - baseRecovered,
        week: `Week ${i + 1}`
      });
    }
    return data;
  };

  // Moving average calculation
  const calculateMovingAverage = (data, window = 5) => {
    return data.map((item, index) => {
      if (index < window - 1) return { ...item, ma: item[selectedMetric] };
      
      const sum = data.slice(index - window + 1, index + 1)
        .reduce((acc, curr) => acc + curr[selectedMetric], 0);
      return { ...item, ma: Math.floor(sum / window) };
    });
  };

  // Simple linear forecast
  const generateForecast = (data, periods = 10) => {
    if (data.length < 10) return [];
    
    const last10 = data.slice(-10);
    const trend = (last10[9][selectedMetric] - last10[0][selectedMetric]) / 9;
    const forecast = [];
    
    for (let i = 1; i <= periods; i++) {
      const lastDate = new Date(data[data.length - 1].date);
      lastDate.setDate(lastDate.getDate() + i * 7);
      
      const predictedValue = Math.max(0, Math.floor(
        data[data.length - 1][selectedMetric] + (trend * i)
      ));
      
      forecast.push({
        date: lastDate.toISOString().split('T')[0],
        [selectedMetric]: predictedValue,
        forecast: true,
        week: `Forecast ${i}`
      });
    }
    return forecast;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900">Loading COVID-19 Data...</h2>
          <p className="text-gray-600 mt-2">Please wait while we process the dataset</p>
        </div>
      </div>
    );
  }

  const processedData = calculateMovingAverage(data);
  const forecastData = showForecast ? generateForecast(data) : [];
  const chartData = [...processedData, ...forecastData];

  const metrics = [
    { key: 'confirmed', label: 'Confirmed Cases', color: '#ff7300' },
    { key: 'deaths', label: 'Deaths', color: '#ff4d4f' },
    { key: 'recovered', label: 'Recovered', color: '#52c41a' },
    { key: 'active', label: 'Active Cases', color: '#1890ff' }
  ];

  const currentMetric = metrics.find(m => m.key === selectedMetric);
  const countries = getCountries();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 flex items-center justify-center gap-3">
            <Activity className="w-10 h-10 text-blue-600" />
            COVID-19 Time Series & Forecasting Dashboard
          </h1>
          <p className="text-gray-600">
            {rawData.length > 0 ? `Using real dataset with ${rawData.length} records` : 'Using simulated data for demonstration'}
          </p>
        </div>

        {/* Educational Content */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-green-600" />
              Time Series Analysis
            </h2>
            <p className="text-gray-700 leading-relaxed">
              Time series analysis examines data points collected over time intervals. In COVID-19 data, we track metrics like confirmed cases, deaths, and recoveries chronologically. This reveals patterns, trends, and seasonality. Key components include trend (long-term direction), seasonality (recurring patterns), and noise (random fluctuations). Moving averages help smooth data to identify underlying trends by reducing short-term volatility.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-purple-600" />
              Forecasting Applications
            </h2>
            <p className="text-gray-700 leading-relaxed">
              Forecasting predicts future values based on historical patterns. For COVID-19, this helps healthcare systems plan resources, governments implement policies, and researchers understand disease progression. Methods include linear regression, ARIMA models, and machine learning approaches. Accuracy depends on data quality, external factors (policy changes, variants), and forecast horizon. Short-term predictions are generally more reliable than long-term ones.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {/* Country Selector */}
              {countries.length > 1 && (
                <select
                  value={selectedCountry}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium"
                >
                  {countries.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              )}
              
              {/* Metric Buttons */}
              {metrics.map(metric => (
                <button
                  key={metric.key}
                  onClick={() => setSelectedMetric(metric.key)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedMetric === metric.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {metric.label}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setShowForecast(!showForecast)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                showForecast
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {showForecast ? 'Hide Forecast' : 'Show Forecast'}
            </button>
          </div>
        </div>

        {/* Main Chart */}
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <h3 className="text-xl font-semibold mb-4">
            {currentMetric.label} Over Time - {selectedCountry} {showForecast && '(with Forecast)'}
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [
                  value.toLocaleString(),
                  name === selectedMetric ? currentMetric.label : 'Moving Average'
                ]}
                labelFormatter={(label) => `Time Period: ${label}`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey={selectedMetric} 
                stroke={currentMetric.color}
                strokeWidth={2}
                dot={{ fill: currentMetric.color, r: 3 }}
                connectNulls={false}
              />
              <Line 
                type="monotone" 
                dataKey="ma" 
                stroke="#666"
                strokeDasharray="5 5"
                strokeWidth={1}
                dot={false}
                name="Moving Average"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Key Insights */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              Data Source
            </h3>
            <p className="text-gray-600">
              {rawData.length > 0 
                ? 'Using real COVID-19 data from Kaggle dataset. Data shows actual reported cases, deaths, and recoveries from official sources.'
                : 'Currently using simulated data. Download the CSV file and place it in public/data/ folder to use real data.'
              }
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-3">Trend Analysis</h3>
            <p className="text-gray-600">
              The moving average line helps identify the overall trend by smoothing out daily fluctuations. This is crucial for understanding whether cases are increasing, decreasing, or stabilizing over time.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold mb-3">Forecasting Limitations</h3>
            <p className="text-gray-600">
              Simple linear forecasts assume trends continue unchanged. Real-world factors like policy interventions, seasonal effects, and behavioral changes can significantly impact accuracy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;