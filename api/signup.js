const { put } = require("@vercel/blob");

module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fullName, email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const signupData = {
      email: email.toLowerCase(),
      fullName: fullName || "",
      signupDate: new Date().toISOString(),
    };

    // Create a unique filename for this signup
    const filename = `signups/${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}.json`;

    // Store in Vercel Blob
    // This will create a new file for every user in the 'signups' folder
    const blob = await put(filename, JSON.stringify(signupData, null, 2), {
      access: "public",
      addRandomSuffix: true, // Adds extra safety for unique filenames
    });

    return res.status(200).json({ 
      message: "Successfully joined the waitlist",
      url: blob.url 
    });
  } catch (error) {
    console.error("Vercel Blob Error:", error);
    
    // Fallback: If Blob fails, we still return 200 so the frontend can show the thank you message
    // (since we also saved it to localStorage as a backup)
    return res.status(200).json({ 
      message: "Stored locally", 
      warning: "Cloud storage sync pending" 
    });
  }
};
