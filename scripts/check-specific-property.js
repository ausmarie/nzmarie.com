const { Pool } = require('pg');

const LOUIS_DB_URL = 'postgresql://nz-property:dscf1BymwHmJCItzMkq_aA@jazzed-buzzard-25204.j77.aws-ap-southeast-3.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full';

const louisPool = new Pool({
  connectionString: LOUIS_DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  connectionTimeoutMillis: 10000,
});

async function checkSpecificProperty() {
  try {
    console.log('🔍 Checking: 1 19 Roanoke Way Albany Auckland 0632\n');
    
    // Get all columns from information_schema
    const columnsQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'properties'
      ORDER BY ordinal_position;
    `;
    
    const columnsResult = await louisPool.query(columnsQuery);
    
    console.log('📋 ALL COLUMNS IN properties TABLE:\n');
    console.log('='  .repeat(80));
    columnsResult.rows.forEach((col, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${col.column_name.padEnd(30)} ${col.data_type.padEnd(25)} ${col.is_nullable === 'NO' ? '(required)' : ''}`);
    });
    console.log('='  .repeat(80));
    console.log(`\nTotal: ${columnsResult.rows.length} columns\n`);
    
    // Query specific property
    const query = `
      SELECT *
      FROM properties
      WHERE address LIKE '%19 Roanoke Way%'
      LIMIT 1
    `;
    
    const result = await louisPool.query(query);
    
    if (result.rows.length === 0) {
      console.log('❌ Property not found!');
      
      // Try fuzzy search
      console.log('\n🔎 Trying fuzzy search...');
      const fuzzyQuery = `
        SELECT address
        FROM properties
        WHERE address LIKE '%Roanoke%'
        LIMIT 5
      `;
      const fuzzyResult = await louisPool.query(fuzzyQuery);
      console.log('\nFound similar addresses:');
      fuzzyResult.rows.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.address}`);
      });
      return;
    }
    
    const property = result.rows[0];
    
    console.log('\n📍 PROPERTY DATA FOR: 1 19 Roanoke Way Albany Auckland 0632\n');
    console.log('='  .repeat(80));
    
    // Display all fields with their values
    Object.keys(property).forEach((key) => {
      const value = property[key];
      let displayValue;
      
      if (value === null) {
        displayValue = '❌ NULL';
      } else if (typeof value === 'object') {
        displayValue = '✅ ' + JSON.stringify(value);
      } else if (typeof value === 'boolean') {
        displayValue = value ? '✅ true' : '❌ false';
      } else if (typeof value === 'number') {
        displayValue = '✅ ' + value.toLocaleString();
      } else if (value === '') {
        displayValue = '⚠️  EMPTY STRING';
      } else {
        displayValue = '✅ ' + value;
      }
      
      console.log(`${key.padEnd(30)} ${displayValue}`);
    });
    
    console.log('='  .repeat(80));
    
    // Summary
    console.log('\n📊 DATA COMPLETENESS SUMMARY:\n');
    const nullFields = [];
    const hasDataFields = [];
    
    Object.keys(property).forEach((key) => {
      if (property[key] === null) {
        nullFields.push(key);
      } else {
        hasDataFields.push(key);
      }
    });
    
    console.log(`✅ Has Data: ${hasDataFields.length} fields`);
    console.log(`❌ NULL: ${nullFields.length} fields\n`);
    
    console.log('Fields with data:');
    hasDataFields.forEach(field => {
      console.log(`  ✓ ${field}`);
    });
    
    console.log('\nFields that are NULL:');
    nullFields.forEach(field => {
      console.log(`  ✗ ${field}`);
    });
    
    // Check what API is currently selecting
    console.log('\n\n🔍 WHAT API IS SELECTING (SQL Query):\n');
    console.log('='  .repeat(80));
    const apiQuery = `
      SELECT 
        id,
        REGEXP_REPLACE(address, '\\\\s+\\\\d{7,}$', '') as address,
        suburb,
        city,
        bedrooms,
        bathrooms,
        car_spaces as garages,
        capital_value as rv,
        last_sold_price,
        last_sold_date,
        year_built as build_year,
        land_area_numeric as land_area,
        floor_size as floor_area,
        cover_image_url as image_url
      FROM properties
      WHERE address LIKE '%19 Roanoke Way%'
      LIMIT 1
    `;
    
    const apiResult = await louisPool.query(apiQuery);
    if (apiResult.rows.length > 0) {
      console.log('API Returns:');
      console.log(JSON.stringify(apiResult.rows[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await louisPool.end();
  }
}

checkSpecificProperty();
