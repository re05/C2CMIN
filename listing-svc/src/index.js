import express from 'express';
import cors from 'cors';
import routes from './routes.js';

const app = express();
const origin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({
  origin,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: false,
}));
app.options('*', cors());
app.use(express.json());
app.use(routes);

const port = Number(process.env.PORT || 0) || 4000;
app.listen(port, () => console.log(`listening on ${port}`));
