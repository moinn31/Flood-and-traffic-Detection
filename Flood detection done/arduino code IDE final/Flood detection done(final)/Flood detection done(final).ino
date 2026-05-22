#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>

// ================= WIFI =================

const char* ssid = "Vivek";
const char* password = "00000000";

// ================= NODE SERVER =================

String serverUrl = "http://10.143.216.76:3000/flood";

// ================= PINS =================

#define TRIG_PIN D5
#define ECHO_PIN D6
#define BUZZER_PIN D7

// ================= VARIABLES =================

long duration;
float distance;

// ================= VADODARA AREAS =================

String areas[] = {

  "Karelibaug",
  "Manjalpur",
  "Waghodia Road",
  "Subhanpura",
  "Akota",
  "Alkapuri",
  "Gotri",
  "Harni",
  "Fatehgunj",
  "Sayajigunj"

};

// Total Areas

int totalAreas = 10;

// Current Area Index

int currentArea = 0;

// =========================================

void setup() {

  Serial.begin(115200);

  pinMode(TRIG_PIN, OUTPUT);

  pinMode(ECHO_PIN, INPUT);

  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(BUZZER_PIN, LOW);

  // ================= WIFI =================

  WiFi.mode(WIFI_STA);

  WiFi.begin(ssid, password);

  Serial.print("Connecting To WiFi");

  while (WiFi.status() != WL_CONNECTED) {

    delay(500);

    Serial.print(".");
  }

  Serial.println("");

  Serial.println("WiFi Connected");

  Serial.print("ESP IP Address: ");

  Serial.println(WiFi.localIP());
}

// =========================================

void loop() {

  // ================= ULTRASONIC SENSOR =================

  digitalWrite(TRIG_PIN, LOW);

  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);

  delayMicroseconds(10);

  digitalWrite(TRIG_PIN, LOW);

  duration = pulseIn(ECHO_PIN, HIGH, 30000);

  // ================= DISTANCE =================

  distance = duration * 0.034 / 2;

  // ================= INVALID CHECK =================

  if (distance <= 0 || distance > 400) {

    Serial.println("Invalid Distance Reading");

    delay(2000);

    return;
  }

  // ================= FLOOD STATUS =================

  String floodStatus;

  if (distance > 15) {

    floodStatus = "Safe";

    digitalWrite(BUZZER_PIN, LOW);
  }

  else if (distance > 7) {

    floodStatus = "Warning";

    digitalWrite(BUZZER_PIN, LOW);
  }

  else {

    floodStatus = "Flood";

    digitalWrite(BUZZER_PIN, HIGH);

    delay(300);

    digitalWrite(BUZZER_PIN, LOW);

    delay(300);
  }

  // ================= CURRENT AREA =================

  String currentAreaName = areas[currentArea];

  // ================= SERIAL OUTPUT =================

  Serial.println("--------------------------------");

  Serial.print("Current Area: ");

  Serial.println(currentAreaName);

  Serial.print("Distance: ");

  Serial.print(distance);

  Serial.println(" cm");

  Serial.print("Flood Status: ");

  Serial.println(floodStatus);

  // ================= SEND DATA =================

  if (WiFi.status() == WL_CONNECTED) {

    WiFiClient client;

    HTTPClient http;

    Serial.println("Connecting To Node Server...");

    http.begin(client, serverUrl);

    http.addHeader("Content-Type", "application/json");

    // ================= JSON DATA =================

    String jsonData =
    "{"
    "\"sensor_id\":\"FS-001\","
    "\"sensor_name\":\"Flood Sensor\","
    "\"area_name\":\"" + currentAreaName + "\","
    "\"water_level\":" + String(distance, 2) + ","
    "\"flood_status\":\"" + floodStatus + "\""
    "}";

    Serial.println("Sending JSON:");

    Serial.println(jsonData);

    int httpResponseCode = http.POST(jsonData);

    Serial.print("HTTP Response Code: ");

    Serial.println(httpResponseCode);

    String response = http.getString();

    Serial.print("Server Response: ");

    Serial.println(response);

    http.end();
  }

  else {

    Serial.println("WiFi Disconnected");
  }

  // ================= NEXT AREA =================

  currentArea++;

  // Restart From First Area

  if (currentArea >= totalAreas) {

    currentArea = 0;
  }

  // ================= DELAY =================

  delay(5000);
}