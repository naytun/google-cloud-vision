import React from "react";
import {
   ActivityIndicator,
   Button,
   Clipboard,
   FlatList,
   Image,
   Platform,
   Share,
   StatusBar,
   StyleSheet,
   Text,
   TouchableOpacity,
   ScrollView,
   View
} from "react-native";
import { Constants, ImagePicker, Permissions } from "expo";
import uuid from "uuid";
import Environment from "../config/environment";
import firebase from "../utils/firebase";

console.disableYellowBox = true;

export default class LinksScreen extends React.Component {
   static navigationOptions = {
      title: "Google Cloud Vision - OCR"
   };

   state = {
      image: null,
      uploading: false,
      googleResponse: null
   };

   async componentDidMount() {
      await Permissions.askAsync(Permissions.CAMERA_ROLL);
      await Permissions.askAsync(Permissions.CAMERA);
   }

   render() {
      let { uploading, image, googleResponse } = this.state;
      let responses =
         googleResponse && googleResponse.responses[0]
            ? googleResponse.responses[0]
            : null;
      let labelAnnotations,
         webDetection,
         fullTextAnnotation,
         landmarkAnnotations = null;

      if (!uploading && responses) {
         fullTextAnnotation = responses.fullTextAnnotation
            ? responses.fullTextAnnotation.text
            : null;
         labelAnnotations = responses.labelAnnotations;
         webDetection = responses.webDetection.bestGuessLabels[0].label;
         landmarkAnnotations = responses.landmarkAnnotations;
      }
      // console.log("responses:", responses);

      return (
         <View style={styles.container}>
            <ScrollView
               style={styles.container}
               contentContainerStyle={styles.contentContainer}
            >
               <View style={styles.helpContainer}>
                  <Button
                     onPress={this._pickImage}
                     title="Pick an image from camera roll"
                  />
                  <Button onPress={this._takePhoto} title="Take a photo" />

                  {/* Image */}
                  {this._maybeRenderImage()}
                  {this._maybeRenderUploadingOverlay()}

                  {labelAnnotations ? (
                     <View>
                        {/* Internet Search  */}
                        <Text style={styles.headingText}>Internet Search</Text>
                        <Text>{webDetection}</Text>

                        {/* OCR-Text */}
                        {fullTextAnnotation && fullTextAnnotation.length > 0 ? (
                           <View>
                              <Text style={styles.headingText}>OCR Text</Text>
                              <Text>{fullTextAnnotation}</Text>
                           </View>
                        ) : null}

                        {/* Image Label  */}
                        <Text style={styles.headingText}>
                           Image Descriptions
                        </Text>
                        {labelAnnotations.map((item, index) => {
                           return <Text key={index}>{item.description}</Text>;
                        })}

                        {/* Landmark  */}
                        {landmarkAnnotations ? (
                           <View>
                              <Text style={styles.headingText}>Landmark</Text>
                              {landmarkAnnotations.map((item, index) => {
                                 return (
                                    <Text key={index}>{item.description}</Text>
                                 );
                              })}
                           </View>
                        ) : null}
                     </View>
                  ) : null}
               </View>
            </ScrollView>
         </View>
      );
   }

   organize = array => {
      return array.map(function(item, i) {
         return (
            <View key={i}>
               <Text>{item}</Text>
            </View>
         );
      });
   };

   _maybeRenderUploadingOverlay = () => {
      if (this.state.uploading) {
         return (
            <View
               style={[
                  StyleSheet.absoluteFill,
                  {
                     backgroundColor: "rgba(0,0,0,0.4)",
                     alignItems: "center",
                     justifyContent: "center"
                  }
               ]}
            >
               <ActivityIndicator color="#fff" animating size="large" />
            </View>
         );
      }
   };

   _maybeRenderImage = () => {
      let { image, googleResponse } = this.state;
      if (!image) {
         return;
      }

      return (
         <View
            style={{
               marginTop: 20,
               width: 250,
               borderRadius: 3,
               elevation: 2
            }}
         >
            <View
               style={{
                  borderTopRightRadius: 3,
                  borderTopLeftRadius: 3,
                  shadowColor: "rgba(0,0,0,1)",
                  shadowOpacity: 0.2,
                  shadowOffset: { width: 4, height: 4 },
                  shadowRadius: 5,
                  overflow: "hidden"
               }}
            >
               <Image
                  source={{ uri: image }}
                  style={{ width: 250, height: 250 }}
               />
            </View>
            <Button
               style={{ padding: 20, backgroundColor: "orange" }}
               onPress={() => this.submitToGoogle()}
               title="Analyze!"
            />
         </View>
      );
   };

   _keyExtractor = (item, index) => item.description;

   _renderItem = item => {
      <Text>response: {JSON.stringify(item)}</Text>;
   };

   _share = () => {
      Share.share({
         message: JSON.stringify(this.state.googleResponse.responses),
         title: "Check it out",
         url: this.state.image
      });
   };

   _copyToClipboard = () => {
      Clipboard.setString(this.state.image);
      alert("Copied to clipboard");
   };

   _takePhoto = async () => {
      let pickerResult = await ImagePicker.launchCameraAsync({
         allowsEditing: true
         //aspect: [4, 3]
      });

      this._handleImagePicked(pickerResult);
   };

   _pickImage = async () => {
      let pickerResult = await ImagePicker.launchImageLibraryAsync({
         allowsEditing: true
         //aspect: [4, 3]
      });

      this._handleImagePicked(pickerResult);
   };

   _handleImagePicked = async pickerResult => {
      try {
         this.setState({ uploading: true, image: null, googleResponse: null });

         if (!pickerResult.cancelled) {
            uploadUrl = await uploadImageAsync(pickerResult.uri);
            this.setState({ image: uploadUrl });
         }
      } catch (e) {
         console.log(e);
         alert("Upload failed, sorry :(");
      } finally {
         this.setState({ uploading: false });
      }
   };

   submitToGoogle = async () => {
      try {
         this.setState({ uploading: true });
         let { image } = this.state;
         let body = JSON.stringify({
            requests: [
               {
                  features: [
                     { type: "LABEL_DETECTION", maxResults: 10 },
                     { type: "LANDMARK_DETECTION", maxResults: 5 },
                     { type: "FACE_DETECTION", maxResults: 5 },
                     { type: "LOGO_DETECTION", maxResults: 5 },
                     { type: "TEXT_DETECTION", maxResults: 5 },
                     { type: "DOCUMENT_TEXT_DETECTION", maxResults: 5 },
                     { type: "SAFE_SEARCH_DETECTION", maxResults: 5 },
                     { type: "IMAGE_PROPERTIES", maxResults: 5 },
                     { type: "CROP_HINTS", maxResults: 5 },
                     { type: "WEB_DETECTION", maxResults: 5 }
                  ],
                  image: {
                     source: {
                        imageUri: image
                     }
                  }
               }
            ]
         });
         let response = await fetch(
            "https://vision.googleapis.com/v1/images:annotate?key=" +
               Environment["GOOGLE_CLOUD_VISION_API_KEY"],
            {
               headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json"
               },
               method: "POST",
               body: body
            }
         );
         let responseJson = await response.json();
         //console.log(responseJson);
         this.setState({
            googleResponse: responseJson,
            uploading: false
         });
      } catch (error) {
         console.log(error);
      }
   };
}

async function uploadImageAsync(uri) {
   // Why are we using XMLHttpRequest? See:
   // https://github.com/expo/expo/issues/2402#issuecomment-443726662
   const blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function() {
         resolve(xhr.response);
      };
      xhr.onerror = function(e) {
         console.log(e);
         reject(new TypeError("Network request failed"));
      };
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
   });

   const ref = firebase
      .storage()
      .ref("/")
      .child(uuid.v4());
   const snapshot = await ref.put(blob);

   // We're done with the blob, close and release it
   blob.close();

   return await snapshot.ref.getDownloadURL();
}

const styles = StyleSheet.create({
   container: {
      flex: 1,
      backgroundColor: "#fff",
      paddingBottom: 10
   },
   contentContainer: {
      flexGrow: 1,
      justifyContent: "center"
   },
   developmentModeText: {
      marginBottom: 20,
      color: "rgba(0,0,0,0.4)",
      fontSize: 14,
      lineHeight: 19,
      textAlign: "center"
   },
   welcomeContainer: {
      alignItems: "center",
      marginTop: 10,
      marginBottom: 20
   },
   welcomeImage: {
      width: 100,
      height: 80,
      resizeMode: "contain",
      marginTop: 3,
      marginLeft: -10
   },
   getStartedContainer: {
      alignItems: "center",
      marginHorizontal: 50
   },
   headingText: {
      fontSize: 17,
      fontWeight: "bold",
      color: "rgba(96,100,109, 1)",
      lineHeight: 24,
      textAlign: "center",
      marginVertical: 10
   },

   helpContainer: {
      marginTop: 15,
      alignItems: "center"
   }
});
