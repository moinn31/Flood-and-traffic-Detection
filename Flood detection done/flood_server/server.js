const express = require("express");
const cors = require("cors");

const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

// ================= SUPABASE =================

const supabaseUrl =
"https://asczdgonhfaasskhwifc.supabase.co";

const supabaseKey =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3pkZ29uaGZhYXNza2h3aWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzIwNDgsImV4cCI6MjA5NDM0ODA0OH0.JIFnECFks2QuxbDX-iIYt6R8m7mA7QROZSZTRXfOVlA";

const supabase = createClient(
  supabaseUrl,
  supabaseKey
);

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