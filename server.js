
import dotenv from "dotenv";
import { createApp } from "./src/app.js";

dotenv.config();

const app = createApp();

const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log(`RPMVault backend running on port ${port}`);
});
