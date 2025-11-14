
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import clientsRouter from "./routes/clients.js";
import casesRouter from "./routes/cases.js";
import invoicesRouter from "./routes/invoices.js";
import guardianshipsRouter from "./routes/guardianships.js";
import reportsRouter from "./routes/reports.js";
import calendarRouter from "./routes/calendar.js";
import filesRouter from "./routes/files.js";
import deadlinesRouter from "./routes/deadlines.js";
const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// health
app.get("/api/ping", (req,res)=> res.json({ok:true, ts: Date.now()}));

// routers
app.use("/api/clienti", clientsRouter);
app.use("/api/clients", clientsRouter); // alias
app.use("/api/casi", casesRouter);
app.use("/api/cases", casesRouter);
app.use("/api/fatture", invoicesRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/guardianships", guardianshipsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/deadlines", deadlinesRouter);
app.use("/api/files", filesRouter);

// static (for generated PDFs/exports if we want to host)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use("/static", express.static(path.resolve(__dirname, "../data/static")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log("Backend listening on http://localhost:"+PORT));
