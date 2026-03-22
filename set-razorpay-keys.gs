/**
 * RAZORPAY KEY SETUP TOOL
 * 
 * Instructions:
 * 1. Fill in your actual credentials below.
 * 2. Click "Run" to securely store them in your Apps Script project.
 * 3. Once finished, you can delete this script for extra security.
 */

function updateRazorpayCredentials() {
  const config = {
    "ADMIN_EMAIL": "albertjoshrock101@gmail.com",
    
    // Get this from Razorpay Dashboard -> Settings -> Webhooks -> [Secret]
    "RAZORPAY_WEBHOOK_SECRET": "ENTER_YOUR_SECRET_HERE", 
    
    // Get these from Razorpay Dashboard -> Settings -> API Keys
    "RAZORPAY_KEY_ID": "ENTER_YOUR_KEY_ID_HERE",
    "RAZORPAY_KEY_SECRET": "ENTER_YOUR_KEY_SECRET_HERE"
  };

  console.log("🔐 Updating Script Properties...");
  
  // Validation
  for (let key in config) {
    if (config[key].includes("ENTER_YOUR")) {
      console.error(`❌ ERROR: You must replace '${config[key]}' with your actual value!`);
      return;
    }
  }

  PropertiesService.getScriptProperties().setProperties(config);
  
  console.log("✅ SUCCESS: Your credentials have been securely stored in PropertiesService.");
  console.log("You can now go back to 'payment-webhook.gs' and redeploy the script.");
}
