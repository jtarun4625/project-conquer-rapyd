/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 'use strict';

 // [START all]
 // [START import]
 // The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
 const functions = require('firebase-functions');
 
 // The Firebase Admin SDK to access Firestore.
 const admin = require('firebase-admin');
 admin.initializeApp();
 var db = admin.firestore()
 // [END import]
 
 // [START addMessage]
 // Take the text parameter passed to this HTTP endpoint and insert it into 
 // Firestore under the path /messages/:documentId/original
 // [START addMessageTrigger]
//  exports.addMessage = functions.https.onRequest(async (req, res) => {
//  // [END addMessageTrigger]
//    // Grab the text parameter.
//    const original = req.query.text;
//    // [START adminSdkAdd]
//    // Push the new message into Firestore using the Firebase Admin SDK.
//    const writeResult = await admin.firestore().collection('messages').add({original: original});
//    // Send back a message that we've successfully written the message
//    res.json({result: `Message with ID: ${writeResult.id} added.`});
//    // [END adminSdkAdd]
//  });
//  // [END addMessage]
 
 // [START makeUppercase]
 // Listens for new messages added to /messages/:documentId/original and creates an
 // uppercase version of the message to /messages/:documentId/uppercase
 // [START makeUppercaseTrigger]

 exports.onWebhookCreate = functions.firestore.document('/webhooks/{documentId}')
 .onCreate((snap, context) => {
    // Get an object representing the document
    // e.g. {'name': 'Marie', 'age': 66}
    const newValue = snap.data();

    // access a particular field as you would any JS property
    const name = newValue.name;

    if(newValue.type == "PAYMENT_COMPLETED"){
        console.log("Payment Completed")

        var merchant_reference_id = ""
        var escrow_id = ""
        var payment_id = ""

        merchant_reference_id = newValue.data.merchant_reference_id
        escrow_id = newValue.data.escrow.id
        payment_id = newValue.data.id

        console.log(merchant_reference_id,escrow_id,payment_id)
        var docRef = db.collection("bid").doc(merchant_reference_id);

        return docRef.update({
            paymentReceived: 1,
            payment_id:payment_id,
            escrow_id:escrow_id
        })
        .then(() => {
            console.log("Document successfully updated!");
        })

    }

    // perform desired operations ...
  });
 exports.onCarbonCreditUpdate = functions.firestore.document('/carboncredit/{documentId}')
     .onUpdate((change, context) => {
        
        
 // [END makeUppercaseTrigger]
       // [START makeUppercaseBody]
       // Grab the current value of what was written to Firestore.

       const newValue = change.after.data();

      // ...or the previous value before this update
        const previousValue = change.before.data();
        console.log("root")

        if(previousValue.Approved == "0"){
            console.log("inside prev")
            if(newValue.Approved == "1"){
                console.log("inside newval")

                if(newValue.NumerofCarbonCredit){
                    console.log("inside numero")

                    var docRef = db.collection("users").doc(newValue.uid);
                    var carbonCredit = 0
                    var newCarbonCredit = parseInt(newValue.NumerofCarbonCredit)
                    docRef.get().then((doc) => {
                        if (doc.exists) {
                            console.log("Document data:", doc.data());
                            console.log("Document data:", doc.data().CarbonCredit);
                            carbonCredit = parseInt(doc.data().CarbonCredit)
                            var newCarbonCreditValue = carbonCredit + newCarbonCredit
                            console.log(newCarbonCreditValue)
                            console.log(typeof(newCarbonCreditValue))
                            console.log(typeof(newCarbonCreditValue.toString))

                            db.collection("users").doc(newValue.uid).update({
                                CarbonCredit: newCarbonCreditValue,
                            })
                            .then(() => {
                                console.log("Document successfully written!");
                                return null
                            })
                            .catch((error) => {
                                console.error("Error writing document: ", error);
                            });
                        } else {
                            // doc.data() will be undefined in this case
                            console.log("No such document!");
                        }
                    }).catch((error) => {
                        console.log("Error getting document:", error);
                    });
                    
                    console.log(newValue.NumerofCarbonCredit)
                }
            }
        }
 
       // Access the parameter `{documentId}` with `context.params`
    //    functions.logger.log('ID', context.params.documentId);
    //    functions.logger.log('newValue and previousValur', newValue, previousValue);

    //    console.log('ID', context.params.documentId);
    //    console.log('newValue and previousValur', newValue, previousValue);
       
    //    const uppercase = original.toUpperCase();
       
       // You must return a Promise when performing asynchronous tasks inside a Functions such as
       // writing to Firestore.
       // Setting an 'uppercase' field in Firestore document returns a Promise.
    //    return snap.ref.set({uppercase}, {merge: true});
       // [END makeUppercaseBody]
       return previousValue.Approved
     });
 // [END makeUppercase]
 // [END all]