#!/usr/bin/env python3
"""
Test database connection to Supabase
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('/app/backend/.env')

async def test_connection():
    DATABASE_URL = os.environ.get('DATABASE_URL', '')
    print(f"Testing connection to: {DATABASE_URL[:50]}...")
    
    try:
        # Try different URL formats
        urls_to_try = [
            DATABASE_URL,
            DATABASE_URL.replace('%23', '#'),
            "postgresql://postgres.kamsaojlijhwaofsiiqr:Adityajn109%23@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres"
        ]
        
        for i, url in enumerate(urls_to_try):
            print(f"\nTrying URL format {i+1}...")
            try:
                conn = await asyncpg.connect(url, ssl='require')
                print("✅ Connection successful!")
                
                # Test a simple query
                result = await conn.fetchval('SELECT version()')
                print(f"Database version: {result[:50]}...")
                
                await conn.close()
                return url
            except Exception as e:
                print(f"❌ Failed: {e}")
                
    except Exception as e:
        print(f"❌ All connection attempts failed: {e}")
        return None

if __name__ == "__main__":
    asyncio.run(test_connection())