const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { fullName, email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  // Check if AWS credentials are provided
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.log("AWS Credentials missing. Signup captured locally in browser only.");
    return res.status(200).json({ 
      message: "Captured locally (AWS not configured)",
      localOnly: true 
    });
  }

  try {

    await docClient.send(command);

    return res.status(200).json({ message: "Successfully joined the waitlist" });
  } catch (error) {
    console.error("DynamoDB Error:", error);
    return res.status(500).json({ error: "Failed to store details" });
  }
};
