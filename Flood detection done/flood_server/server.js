const express = require("express");
const cors = require("cors");

const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

// ================= SUPABASE =================
const path = require("path");
try {
  require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
} catch (e) {}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

let supabase = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (err) {
    console.warn("[Supabase] Init error:", err.message);
  }
}

// ================= TEST ROUTE =================

app.get("/", (req, res) => {

  res.send("Flood Server Running");
});

// ================= API =================

app.post("/flood", async (req, res) => {

  try {

    const data = req.body;

    console.log("Received Data:", data);

    const { error } = await supabase
      .from("flood_data")
      .insert([data]);

    if (error) {

      console.log("Supabase Error:", error);

      return res.status(500).json(error);
    }

    console.log("Data Inserted Successfully");

    res.status(200).json({
      success: true,
      message: "Data Stored Successfully"
    });

  }

  catch (err) {

    console.log("Server Error:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

// ================= SERVER =================

app.listen(3000, "0.0.0.0", () => {

  console.log("Server Running On Port 3000");
});