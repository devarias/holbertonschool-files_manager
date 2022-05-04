const axios = require('axios');
const uuid = require('uuid');

const randomFileName = () => {
  const id = uuid.v4();
  return id.split('-')[0];
};

axios.get('http://localhost:5000/connect', {
  headers: { Authorization: 'Basic 2XJILLyXZDDtnuZ2ek90i9S1egtA6hl=', },
})
  .then((response) => response.data.token)
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
  })
  .then((token) => {
    const headers = {
      'X-Token': token,
      'Content-Type': 'application/json',
    };
    const data = {
      name: 'images',
      type: 'folder',
    };

    axios.post('http://localhost:5000/files',
      data,
      {
        headers,
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
      })
      .then((response) => {
        console.log('File created:', response.data);
        return response;
      })
      .then((response) => {
        const { id } = response.data;

        axios.get(`http://localhost:5000/files/${id}`, {
          headers: { 'X-Token': token },
        })
          .then((response) => {
            console.log('File found:', response.data);
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
      });
  });
