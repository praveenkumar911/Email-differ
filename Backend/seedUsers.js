import mongoose from "mongoose";
import "dotenv/config";
import EmailUser from "./models/EmailUsers.js"; // Make sure EmailUser model exists (ES module default export)

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.log("❌ DB Error:", err));

// Dummy Users
const dummyUsers = [
  { name: "Alice Johnson", email: "praveenkumarpalaboyina@gmail.com", phone: "1234567890", githubId: "alicej", githubUrl: "https://github.com/alicej", discordId: "alice#1234" },
 { name: "Bob Smith", email: "sampathchowdarie@gmail.com", phone: "0987654321", githubId: "bobsmith", githubUrl: "https://github.com/bobsmith", discordId: "bob#5678" },
  { name: "Charlie Brown", email: "kolllipavan753@gmail.com", phone: "5555555555", githubId: "charlieb", githubUrl: "https://github.com/charlieb", discordId: "charlie#9012" },
  { name: "Bhanu Gunnam", email: "bhavani.gunnam@research.iiit.ac.in", phone: "4444444444", githubId: "dianap", githubUrl: "https://github.com/dianap", discordId: "diana#3456" },
   { name: "Ethan Hunt", email: "ajaysigiredy908@gmail.com", phone: "3333333333", githubId: "ethanh", githubUrl: "https://github.com/ethanh", discordId: "ethan#7890" },
  // { name: "Fiona Gallagher", email: "praveenkumarpalaboyina@gmail.com", phone: "2222222222", githubId: "fionag", githubUrl: "https://github.com/fionag", discordId: "fiona#2345" },

];

    // Insert into MongoDB
const seedUsers = async () => {
  try {
    await EmailUser.deleteMany(); // optional: clear existing users
    await EmailUser.insertMany(dummyUsers);
    console.log("✅ Dummy users inserted successfully");
    // Close mongoose connection gracefully
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.log("❌ Error seeding users:", err);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
};

seedUsers();
