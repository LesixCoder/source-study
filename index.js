// const { URLSearchParams } = require('url');
// const params = new URLSearchParams();
const FormData = require('form-data');
const params = new FormData();
params.append('Books[name]', '测试');
params.append('Books[author]', '数据');

const fetch = require('node-fetch');
fetch('http://localhost/basic/web/index.php?r=books/create', { method: 'POST', body: params })
  .then((res) => res.json())
  .then((json) => console.log(json));

// const axios = require("axios");
// axios.post('http://localhost/basic/web/index.php?r=books/create', params)
//     .then(function (response) {
//         console.log(response.data);
//     })
//     .catch(function (error) {
//         console.log("🍎", error);
//     });
