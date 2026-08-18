const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function testFormDataRegister() {
  const form = new FormData();
  form.append('name', 'Dawit Solomon Formdata Test');
  form.append('email', `formdata_attorney_${Date.now()}@gmail.com`);
  form.append('password', 'AttorneyPass123!');
  form.append('phone', `+2519${Math.floor(10000000 + Math.random() * 90000000)}`);
  form.append('barRegistrationNumber', 'BAR-ETH-2026-999');
  form.append('barAdmissionYear', '2020');
  form.append('emailContinuationToken', 'email_cont_test');

  try {
    const res = await axios.post('http://localhost:3001/api/v1/auth/register/attorney', form, {
      headers: form.getHeaders(),
    });
    console.log('REGISTRATION SUCCESSFUL:', res.data);
  } catch (err) {
    console.error('REGISTRATION FAILED:', err.response?.data || err.message);
  }
}

testFormDataRegister();
