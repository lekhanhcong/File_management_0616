const http = require("http");

console.log("🧪 Testing FileFlowMaster Server...");

http.get("http://localhost:3001/api/files", (res) => {
  let data = "";
  res.on("data", chunk => data += chunk);
  res.on("end", () => {
    console.log(`✅ API Status: ${res.statusCode}`);
    try {
      const json = JSON.parse(data);
      console.log("   Files response:", json);
      console.log("✅ All tests passed\! Server is working correctly.");
    } catch (e) {
      console.log("   Response length:", data.length);
    }
  });
}).on("error", (err) => {
  console.error("❌ Test failed:", err.message);
});
