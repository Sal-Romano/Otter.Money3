import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';

import { errorHandler } from './middleware/error';
import { authRouter } from './routes/auth';
import { householdRouter } from './routes/household';
import { accountsRouter } from './routes/accounts';
import { transactionsRouter } from './routes/transactions';
import { categoriesRouter } from './routes/categories';
import { rulesRouter } from './routes/rules';
import { dashboardRouter } from './routes/dashboard';
import { healthRouter } from './routes/health';
import plaidRouter from './routes/plaid';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true,
  })
);
app.use(express.json());

// Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/household', householdRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/plaid', plaidRouter);

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🦦 Otter Money API running on port ${PORT}`);
});
