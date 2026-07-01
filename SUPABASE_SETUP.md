# Supabase Database Setup Guide

Follow these steps to set up your PostgreSQL database on Supabase for the ShuttleCoach backend.

## Step 1: Create Supabase Account

1. Go to https://supabase.com
2. Click "Start your project" or "Sign In"
3. Sign up with GitHub, Google, or Email

## Step 2: Create New Project

1. Once logged in, click "New Project"
2. Fill in the project details:
   - **Name**: `shuttlecoach` (or any name you prefer)
   - **Database Password**: Create a strong password (SAVE THIS - you'll need it!)
   - **Region**: Choose closest to you (e.g., US East, EU West, Asia Southeast)
   - **Pricing Plan**: Free tier is sufficient for development

3. Click "Create new project"
4. Wait 2-3 minutes for the project to be provisioned

## Step 3: Get Connection String

1. Once your project is ready, click on the **Settings** icon (gear icon) in the left sidebar
2. Click on **Database** in the settings menu
3. Scroll down to **Connection string** section
4. Select **URI** tab (not Transaction or Session Pooling)
5. Copy the connection string - it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
   ```
6. **Replace `[YOUR-PASSWORD]`** with the database password you created in Step 2

## Step 4: Update .env File

1. Open `/API/shuttlecoach-api/.env` file
2. Replace the `DATABASE_URL` line with your Supabase connection string:
   ```
   DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres
   ```

Example:
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgresql://postgres:MyStr0ngP@ssw0rd@db.abcdefghijklmnop.supabase.co:5432/postgres

# JWT Configuration
JWT_SECRET=dev-secret-key-please-change-in-production

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

## Step 5: Run Migrations

Once your `.env` file is updated:

```bash
cd /Users/midhunvmanikkath/Documents/PROJECTS/LOVEALL/API/shuttlecoach-api

# Install dependencies if not already installed
npm install

# Run the migrations
npm run migrate
```

You should see:
```
🚀 Starting database migrations...

📄 Running migration: 001_initial_schema.sql
✅ Successfully executed: 001_initial_schema.sql

📄 Running migration: 002_seed_data.sql
✅ Successfully executed: 002_seed_data.sql

🎉 All migrations completed successfully!

📊 Database Summary:
-------------------
Users: 6
Students: 6
Batches: 3
Skill Assessments: 3
Fee Records: 12
Curriculum Plans: 1
Training Logs: 4
```

## Step 6: Verify in Supabase Dashboard

1. Go back to your Supabase project dashboard
2. Click on **Table Editor** in the left sidebar
3. You should see all the tables:
   - users
   - students
   - batches
   - skill_assessments
   - fee_records
   - curriculum_plans
   - training_logs

4. Click on any table to see the sample data

## Troubleshooting

### Error: "password authentication failed"
- Double-check the password in your connection string
- Make sure you replaced `[YOUR-PASSWORD]` with your actual password

### Error: "connection refused"
- Verify the connection string is copied correctly
- Check if your Supabase project is fully provisioned (green status)
- Ensure your IP is not blocked (Supabase free tier allows all IPs by default)

### Error: "SSL connection required"
- This is handled automatically by the backend configuration
- Ensure `NODE_ENV=development` or `production` is set

### Can't find connection string
1. Go to Supabase Dashboard
2. Settings → Database
3. Scroll to "Connection string" section
4. Select "URI" tab (not Pooling)

## Sample Login Credentials

Once migrations are complete, you can test with these credentials:

**Head Coach:**
- Username: `headcoach`
- Password: `password123`

**Assistant Coaches:**
- Username: `assistant1` or `assistant2`
- Password: `password123`

**Students:**
- Username: `aarav`, `diya`, or `saanvi`
- Password: `password123`

## Next Steps

After successful migration:
1. ✅ Database schema created
2. ✅ Sample data populated
3. → Start the backend server: `npm run dev`
4. → Test API endpoints
5. → Implement authentication (Task 48)

## Security Notes

- **Change the default password** after testing
- **Update JWT_SECRET** to a strong random string in production
- **Enable Row Level Security (RLS)** in Supabase for production
- **Never commit `.env` file** to version control

## Useful Supabase Features

### SQL Editor
- Run custom queries directly from dashboard
- Test data retrieval and updates

### Database Backups
- Automatic daily backups (paid plans)
- Point-in-time recovery (paid plans)

### Monitoring
- View connection pool status
- Monitor database size and performance

## Support

- Supabase Docs: https://supabase.com/docs
- Supabase Discord: https://discord.supabase.com
- PostgreSQL Docs: https://www.postgresql.org/docs/
