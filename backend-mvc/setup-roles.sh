#!/bin/bash

# Script to setup Role Management system
# This script will create the necessary database tables and insert default data

echo "🚀 Setting up Role Management System..."

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo "❌ PostgreSQL is not running. Please start PostgreSQL first."
    exit 1
fi

# Database connection details
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-signature_db}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-123}

echo "📊 Connecting to database: $DB_NAME on $DB_HOST:$DB_PORT"

# Run the SQL script
echo "📝 Creating roles and permissions tables..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f create-roles-tables.sql

if [ $? -eq 0 ]; then
    echo "✅ Database setup completed successfully!"
    echo ""
    echo "📋 Summary of what was created:"
    echo "   • roles table - stores role definitions"
    echo "   • role_permissions table - stores permissions for each role"
    echo "   • role_id column added to users table"
    echo "   • Default roles: Super Admin, Admin, Manager, User, Viewer"
    echo "   • Default permissions for each role"
    echo "   • Indexes for better performance"
    echo "   • Triggers for automatic timestamp updates"
    echo ""
    echo "🎯 Next steps:"
    echo "   1. Start the backend server: npm run start:dev"
    echo "   2. Start the frontend server: npm run dev"
    echo "   3. Navigate to /roles to manage roles"
    echo "   4. Assign roles to users in the Users section"
    echo ""
    echo "🔐 Default roles and their permissions:"
    echo "   • Super Admin: All permissions"
    echo "   • Admin: Most permissions except Settings"
    echo "   • Manager: Document and History management"
    echo "   • User: Basic document operations"
    echo "   • Viewer: Read-only access"
else
    echo "❌ Database setup failed. Please check the error messages above."
    exit 1
fi
