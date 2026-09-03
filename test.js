const axios = require('axios');

const API_URL = 'http://localhost:4000/api';
const WEBHOOK_URL = 'http://host.docker.internal:5000/royalbet-callback';

async function runTests() {
  console.log('🧪 Running integration tests for GapWala Operator...');
  let token = '';

  // 1. Test Registration
  try {
    const res = await axios.post(`${API_URL}/auth/register`, {
      username: 'testuser_' + Date.now(),
      email: 'test_' + Date.now() + '@test.com',
      password: 'password123',
      balance: 5000,
      currency: 'INR'
    });
    console.log('✅ Registration successful. User ID:', res.data.user.username);
    token = res.data.token;
  } catch (err) {
    console.log('❌ Registration failed:', err.response?.data || err.message);
  }

  // 2. Test Get User Profile (Auth check)
  if (token) {
    try {
      const res = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Get profile successful. Balance:', res.data.user.balance);
    } catch (err) {
      console.log('❌ Get profile failed:', err.response?.data || err.message);
    }
  }

  // 3. Test Webhook - Balance
  try {
    const res = await axios.post(`${WEBHOOK_URL}/balance`, {
      userId: 'testuser_dummy'
    }, {
      headers: { Signature: 'MOCK_BYPASS_FOR_DEVELOPMENT' }
    });
    console.log('✅ Webhook /balance responded successfully.');
  } catch (err) {
    console.log('❌ Webhook /balance failed:', err.response?.data || err.message);
  }

  console.log('🎉 Tests complete!');
}

runTests();
