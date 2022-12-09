/**
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const express = require('express');
const utilities = require('./utilities');
const cookieParser = require('cookie-parser')();
const cors = require('cors')({origin: true});
var bodyParser = require('body-parser')
const { v4: uuidv4 } = require('uuid');
var db = admin.firestore();
const dateTimeFormatter = require('date-and-time');
const { default: axios } = require('axios');
const { appCheck } = require('firebase-admin');
const { make_request } = require('./utilities');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// Express middleware that validates Firebase ID Tokens passed in the Authorization HTTP header.
// The Firebase ID token needs to be passed as a Bearer token in the Authorization HTTP header like this:
// `Authorization: Bearer <Firebase ID Token>`.
// when decoded successfully, the ID Token content will be added as `req.user`.
const validateFirebaseIdToken = async (req, res, next) => {
  functions.logger.log('Check if request is authorized with Firebase ID token');

  if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) &&
      !(req.cookies && req.cookies.__session)) {
    functions.logger.error(
      'No Firebase ID token was passed as a Bearer token in the Authorization header.',
      'Make sure you authorize your request by providing the following HTTP header:',
      'Authorization: Bearer <Firebase ID Token>',
      'or by passing a "__session" cookie.'
    );
    res.status(403).json('Unauthorized');
    return;
  }

  let idToken;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    functions.logger.log('Found "Authorization" header');
    // Read the ID Token from the Authorization header.
    idToken = req.headers.authorization.split('Bearer ')[1];
  } else if(req.cookies) {
    functions.logger.log('Found "__session" cookie');
    // Read the ID Token from cookie.
    idToken = req.cookies.__session;
  } else {
    // No cookie
    res.status(403).json('Unauthorized');
    return;
  }

  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    functions.logger.log('ID Token correctly decoded', decodedIdToken);
    req.user = decodedIdToken;
    next();
    return;
  } catch (error) {
    functions.logger.error('Error while verifying Firebase ID token:', error);
    res.status(403).json('Unauthorized');
    return;
  }
};
app.get('/hello-new', (req, res) => {
  // @ts-ignore
  res.send(`Hello Guest`);
});


app.post("/webhook",(req,res)=>{
  console.log(req.body)

  db.collection("webhooks").doc(uuidv4()).set(req.body).then((response) => {
    res.send({"error":false,"url":"bid.checkout.redirect_url"})
  }).catch((error) => {
    console.log(error)
  })


})

app.use(cors);
app.use(cookieParser);
app.use(validateFirebaseIdToken);

app.get('/hello', (req, res) => {
  // @ts-ignore
  functions.logger.log('User Body', req.user);

  res.json(req.user);
});

app.get('/getCountries',(req, res) => {
  const url_path = "/v1/data/countries";  
  var data = []
  db.collection("countries").get().then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
          data.push(doc.data())
      });
      res.send({"data":data})
  }).catch((error) => {
    res.json({"error":true,"message":"There is some error"})
    console.log(error);
  });
                              
})

var countries = []

function getCodeFromCountries(country){
  return utilities.make_request(url_path,"get");  

}
app.post('/createWallet',(req,res) => {
  const url_path = '/v1/user'
  var state = req.body
  var phone_code = ""
  var date = new Date(state.dob)
  date = dateTimeFormatter.format(date,'MM/DD/YYYY');
  state.dob = date
  db.collection("countries").get().then((querySnapshot) => {
    querySnapshot.forEach((doc) => {
      if(doc.data().name == state.b_address_country){
        state.currency = doc.data().currency_code
        state.b_address_country = doc.data().iso_alpha2
        phone_code = doc.data().phone_code
      }
      if(doc.data().name == state.country){
        state.country = doc.data().iso_alpha2
      }
      if(doc.data().name == state.nationality){
        state.nationality = doc.data().iso_alpha2
      }
      if(doc.data().name == state.c_address_country){
        state.c_address_country = doc.data().iso_alpha2
      }
    });
        utilities.make_request(url_path,"post",
    {
      "first_name": state.business_name,
      "ewallet_reference_id": uuidv4(),
      "metadata": {
          "merchant_defined": true
      },
      "type": "company",
      "contact": {
          "phone_number":"+" + phone_code + state.phone_number,
          "email": state.email,
          "first_name": state.first_name,
          "last_name": state.last_name,
          "contact_type": "business",
          "address": {
              "name": state.c_address_name,
              "line_1": state.c_address_line_1,
              "city": state.c_address_city,
              "state": state.c_address_state,
              "country": state.c_address_country,
              "zip": state.c_address_zip,
          },
          "date_of_birth": state.dob,
          "country": state.country,
          "nationality": state.nationality,
          "metadata": {
              "merchant_defined": true,
              "uid":req.user.uid
          },
          "business_details": {
              "entity_type": state.entity_type,
              "name": state.business_name,
              "registration_number": state.business_name,
              // "industry_category": "company",
              // "industry_sub_category": "home services",
              "address": {
                  "name": state.b_address_name,
                  "line_1": state.b_address_line_1,
                  "city": state.b_address_city,
                  "state": state.b_address_state,
                  "country": state.b_address_country,
                  "zip": state.b_address_zip,
                  "phone_number": "+" + phone_code + state.phone_number,
                  "metadata": {
                      "merchant_defined": true,
                      "uid":req.user.uid
                  }
              }
          }
      }
  }).then(function(response){
    console.log(response.data)
    var wallet_id = response.data.data.id
    var walletData = response.data
    var dataToSendForContact = {
      "phone_number":"+" + phone_code + state.phone_number,
          "email": state.email,
          "first_name": state.first_name,
          "last_name": state.last_name,
          "contact_type": "personal",
          "address": {
              "name": state.c_address_name,
              "line_1": state.c_address_line_1,
              "city": state.c_address_city,
              "state": state.c_address_state,
              "country": state.c_address_country,
              "zip": state.c_address_zip,
          },
          "date_of_birth": state.dob,
          "country": state.country,
          "nationality": state.nationality,
          "metadata": {
              "merchant_defined": true,
              "uid":req.user.uid
          }
  }
    
    if(response.data.status.status == "SUCCESS"){
      utilities.make_request("/v1/ewallets/"+wallet_id+"/contacts","post",dataToSendForContact).then((response) => {
        var contactData = response.data
        if(response.data.status.status == "SUCCESS"){
          var url = response.data.data
          console.log(url)
          var id = url.id
          wallet_id = url.ewallet
          var dataToSend = {
            "reference_id": uuidv4(),
            "ewallet": wallet_id,
            "contact": id,
            "page_expiration": Math.floor(new Date().getTime() / 1000) + 3600000
          }
        }
        utilities.make_request("/v1/hosted/idv","post",dataToSend).then((response) => {
          console.log(response.data)
          var idvData = response.data
          var userRef = db.collection('users').doc(req.user.uid);
          var data = response.data.data
          userRef.set({
            state:state,
            contactData:contactData,
            walletData:walletData,
            idvData:idvData
          },{merge:true}).then((response) => {
            console.log("Data Updated")
            res.send({"error":false,"message":"Wallet Sucessfully Created Please Verify Your Identity on Next Page","data":data})
          }).catch((error) => {
            console.log(error)
          })


        }).catch((error) => {
          console.log(error.response)
          res.json({"error":true,"message":"There is some error"})

        })

      }).catch((error) => {
        console.log(error.response)
        res.json({"error":true,"message":"There is some error"})

      })
    }
  }).catch(function(error){
    res.json({"error":true,"message":"There is some error"})
    console.log(error.response)
  })
  })

 

 


  
})


app.post("/addNewAuction",(req,res) => {
  var docRef = db.collection("users").doc(req.user.uid);
  var auction = req.body
  docRef.get().then((doc) => {
      if (doc.exists) {
          var CarbonCredit = parseInt(doc.data().CarbonCredit)
          var newCarbonCredit = parseInt(auction.CarbonCredit)
          if(CarbonCredit < newCarbonCredit){
            res.send({"error":true,"message":"Not Enough Credits Available for the auctions"})
          }else{
            db.collection("auctions").doc(uuidv4()).set(auction)
            .then(() => {
                console.log("Document successfully written!");
                docRef.set({
                    CarbonCredit: CarbonCredit - newCarbonCredit
                }, { merge: true }).then((response) => {
                  res.send({"error":false,"message":"Auction Added Successfully"})
                }).catch((error) => {
                  console.log(error)
                  res.send({"error":true,"message":"Not Enough Credits Available for the auctions"})
                });
                
            })
            .catch((error) => {
                console.error("Error writing document: ", error);
            });
          }
      } else {
          // doc.data() will be undefined in this case
          console.log("No such document!");
      }
  }).catch((error) => {
      console.log("Error getting document:", error);
  });
})

app.get("/getUserProfile",(req,res) => {
  var docRef = db.collection("users").doc(req.user.uid);
  docRef.get().then((doc) => {
      if (doc.exists) {
          console.log("Document data:", doc.data());
          res.send(doc.data())
      } else {
          // doc.data() will be undefined in this case
          console.log("No such document!");
      }
  }).catch((error) => {
      console.log("Error getting document:", error);
  });
})


app.get("/getAuctions",async (req,res) => {
  var data = [] 
  db.collection("auctions").where("UserId", "!=", req.user.uid).get().then((querySnapshot) => {
    querySnapshot.forEach((querySnapshot) => {
      var dictData = querySnapshot.data()
      dictData["id"] = querySnapshot.id
      data.push(dictData)
    });

    const requests = data.map((item) => {
      var docRef = db.collection("users").doc(item.UserId);
      return docRef.get().then((doc) => {
            if (doc.exists) {
                console.log("Document data:");
                item["currency"] = doc.data().state.currency
            } else {
                // doc.data() will be undefined in this case
                console.log("No such document!");
            }
        }).catch((error) => {
            console.log("Error getting document:", error);
        });
    })

    Promise.all(requests).then(() => {
      console.log("Outside")
      res.send({"error":false,data:data})
    });
    
  }).catch((error) => {
    res.json({"error":true,"message":"There is some error"})
    console.log(error);
  });
})


app.post("/getLocalRate",(req,res) => {
  var data =req.body
  console.log(data)
  make_request("/v1/rates/daily?action_type=payment&buy_currency="+data.buy+"&sell_currency="+data.sell+"&amount="+data.amount+"&fixed_side=sell","get").then((response) => {
    console.log(response.data)
    res.send({"error":false,"data":response.data})
  }).catch((error) => {
    console.log(error.response)
    res.send({"error":true,"data":"There is some error while processing request"})

  })
})


app.post("/createHostedCheckout",(req,res) => {
  var body = req.body
  var userRef = db.collection("users").doc(req.user.uid);
  console.log(body)
  var country = ""
  var wallet_id = ""
  var uuid =uuidv4()
  userRef.get().then((doc) => {
      if (doc.exists) {
          console.log("Document data:");
          var userRefAuction = db.collection("users").doc(body.Auction.UserId);
          userRefAuction.get().then((doc) => {
            if (doc.exists) {
                console.log("Document data:");
                wallet_id = doc.data().walletData.data.id
                console.log(wallet_id,country)
                var data = {
                    "amount": body.LocalRate,
                    "complete_payment_url": "http://example.com/complete",
                    "country": country,
                    "currency": body.LocalCurrency,
                    "error_payment_url": "http://example.com/error",
                    "merchant_reference_id": uuid,
                    "language": "en",
                    "ewallets": [{
                            "ewallet": wallet_id
                        }
                    ],
                    "escrow": true,
                    "metadata": {
                        "merchant_defined": true
                    },
                    "payment_method_types_include": [],
                    "expiration": Math.floor(new Date().getTime() / 1000) + 360000,
                    "payment_method_types_exclude": []
                }
                make_request("/v1/checkout","post",data).then((response) => {
                  console.log(response.data)

                  var oldResponse = response
                  make_request("/v1/rates/daily?action_type=payment&buy_currency="+body.Currency+"&sell_currency="+body.LocalCurrency+"&amount="+body.YourBid+"&fixed_side=sell","get").then((response) => {
                    console.log(response.data.data.buy_amount)
                    console.log(oldResponse.data.data)
                    var bid = {
                      auction:req.body.Auction.id,
                      paymentReceived:0,
                      reference_id:data.merchant_reference_id,
                      checkout:oldResponse.data.data,
                      LocalCurrency:response.data.data.buy_amount,
                      body:req.body
                    }
                    db.collection("bid").doc(uuid).set(bid).then((response) => {
                      console.log("New Data")
                      console.log(bid)
                      console.log(bid.checkout.redirect_url)
                      res.send({"error":false,"url":bid.checkout.redirect_url})
                    }).catch((error) => {
                      console.log(error)
                    })
                  }).catch((error) => {
                    console.log(error.response)
                    res.send({"error":true,"data":"There is some error while processing request"})
                
                  })

                  

                }).catch((error) => {
                  console.log(error.response)
                })
            } else {
                // doc.data() will be undefined in this case
                console.log("No such document!");
            }
        }).catch((error) => {
            console.log("Error getting document:", error);
        });
          country = doc.data().state.country
      } else {
          // doc.data() will be undefined in this case
          console.log("No such document!");
      }
  }).catch((error) => {
      console.log("Error getting document:", error);
  });

})


app.post("/acceptBid",(req,res) => {
  var body = req.body

  var userRef = db.collection('users').doc(req.user.uid);
  userRef.get().then((doc) => {
    console.log(doc)
    var walletAmount = doc.data().walletAmount
    userRef.update({
      walletAmount:walletAmount+body.LocalCurrency
    }).then((response) => {
      var auction = db.collection('auctions').doc(body.auction);
      auction.update({
        live:0,
      }).then((response) => {
        res.send({"error":false})
      })

      console.log("Successfully Added")
    }).catch((error) => {
      console.log(error)
    })
  })
})
// This HTTPS endpoint can only be accessed by your Firebase Users.
// Requests need to be authorized by providing an `Authorization` HTTP header
// with value `Bearer <Firebase ID Token>`.
exports.app = functions.https.onRequest(app);

