const axios = require('axios');
const uuid = require('uuid');

axios({
  method: 'post',
  url: 'http://localhost:5000/users',
  data: {
    email: process.argv[2],
    password: uuid.v4(),
  },
  headers: { 'Content-Type': 'application/json', },
}).then((response) => {
  console.log('User created:', response.data);
})
  .catch((err) => {
    if (err.response) {
      console.log('Response from server:', err.response.data);
      console.log('Status:', err.response.status);
      console.log('Headers:', err.response.headers);
    } else if (err.request) {
      console.log(err.request);
    } else {
      console.log('Error:', err.message);
    }
  });
