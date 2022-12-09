const CryptoJS = require("crypto-js");
const axios = require('axios');



const getSignature = (http_method,url_path,salt,timestamp,access_key,secret_key,data) => {
  const to_sign =
    http_method + url_path + salt + timestamp + access_key + secret_key + data;
  let signature = CryptoJS.enc.Hex.stringify(
    CryptoJS.HmacSHA256(to_sign, secret_key)
  );

  signature = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(signature));

  return signature;
};







// You can use any HTTP request library to make the request. Example: Axios




module.exports = {
    make_request: function(url_path,http_method,post_data=""){
        const salt = CryptoJS.lib.WordArray.random(12);                              // Randomly generated for each request.
        const timestamp = (Math.floor(new Date().getTime() / 1000) - 10).toString(); // Current Unix time (seconds).
        const access_key = "B85A1FC5A9B9B53522FB";                                                       // The access key from Client Portal.
        const secret_key = "6af8b2b82f3b8ae08b31e567468eda3a180d2d7b8c62ae3aa2baee92dd647a520108174c6e01f462"; 
        var data = ""
        if(post_data != ""){
            data = JSON.stringify(post_data);  
        }
        
        const headers = {
            access_key,
            signature: getSignature(http_method,url_path,salt,timestamp,access_key,secret_key,data),
            salt,
            timestamp,
            "Content-Type": `application/json`,
          };
        const request = {
            baseURL: "https://sandboxapi.rapyd.net",
            headers,
            url: url_path,
            method: http_method,
            data,
          };
       return axios(request)
    }
}