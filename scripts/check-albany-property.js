const { Pool } = require('pg');

// Louis DB connection string (Jakarta region)
const LOUIS_DB_URL = 'postgresql://nz-property:dscf1BymwHmJCItzMkq_aA@jazzed-buzzard-25204.j77.aws-ap-southeast-3.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full';

const louisPool = new Pool({
  connectionString: LOUIS_DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  connectionTimeoutMillis: 10000,
});

async function checkAlbanyProperties() {
  try {
    console.log('🏠 Checking Albany properties...\n');
    
    // Query properties from Albany
    const query = `
      SELECT 
        id,
        address,
        suburb,
        city,
        bedrooms,
        bathrooms,
        car_spaces,
        capital_value,
        last_sold_price,
        last_sold_date,
        year_built,
        land_area_numeric,
        floor_size,
        cover_image_url
      FROM properties
      WHERE LOWER(suburb) = 'albany'
      LIMIT 5
    `;
    
    const result = await louisPool.query(query);
    
    console.log(`Found ${result.rows.length} properties in Albany\n`);
    console.log('='  .repeat(80));
    
    result.rows.forEach((prop, index) => {
      console.log(`\n${index + 1}. ${prop.address}`);
      console.log(`   Suburb: ${prop.suburb}`);
      console.log(`   City: ${prop.city}`);
      console.log(`   Bedrooms: ${prop.bedrooms !== null ? prop.bedrooms : 'NULL'}`);
      console.log(`   Bathrooms: ${prop.bathrooms !== null ? prop.bathrooms : 'NULL'}`);
      console.log(`   Car Spaces: ${prop.car_spaces !== null ? prop.car_spaces : 'NULL'}`);
      console.log(`   RV (Capital Value): ${prop.capital_value !== null ? '$' + prop.capital_value.toLocaleString() : 'NULL'}`);
      console.log(`   Last Sold Price: ${prop.last_sold_price !== null ? '$' + prop.last_sold_price.toLocaleString() : 'NULL'}`);
      console.log(`   Last Sold Date: ${prop.last_sold_date || 'NULL'}`);
      console.log(`   Year Built: ${prop.year_built || 'NULL'}`);
      console.log(`   Land Area: ${prop.land_area_numeric !== null ? prop.land_area_numeric + ' m²' : 'NULL'}`);
      console.log(`   Floor Size: ${prop.floor_size || 'NULL'}`);
      console.log(`   Image: ${prop.cover_image_url ? 'Yes' : 'NULL'}`);
      console.log('   ' + '-'.repeat(76));
    });
    
    console.log('\n📊 Data completeness summary:');
    const stats = {
      hasRV: result.rows.filter(p => p.capital_value !== null).length,
      hasBedrooms: result.rows.filter(p => p.bedrooms !== null).length,
      hasBathrooms: result.rows.filter(p => p.bathrooms !== null).length,
      hasCarSpaces: result.rows.filter(p => p.car_spaces !== null).length,
      hasLastSoldPrice: result.rows.filter(p => p.last_sold_price !== null).length,
      hasYearBuilt: result.rows.filter(p => p.year_built !== null).length,
      hasLandArea: result.rows.filter(p => p.land_area_numeric !== null).length,
      hasFloorSize: result.rows.filter(p => p.floor_size !== null).length,
      hasImage: result.rows.filter(p => p.cover_image_url !== null).length,
    };
    
    console.log(`  RV (Capital Value): ${stats.hasRV}/${result.rows.length} (${Math.round(stats.hasRV/result.rows.length*100)}%)`);
    console.log(`  Bedrooms: ${stats.hasBedrooms}/${result.rows.length} (${Math.round(stats.hasBedrooms/result.rows.length*100)}%)`);
    console.log(`  Bathrooms: ${stats.hasBathrooms}/${result.rows.length} (${Math.round(stats.hasBathrooms/result.rows.length*100)}%)`);
    console.log(`  Car Spaces: ${stats.hasCarSpaces}/${result.rows.length} (${Math.round(stats.hasCarSpaces/result.rows.length*100)}%)`);
    console.log(`  Last Sold Price: ${stats.hasLastSoldPrice}/${result.rows.length} (${Math.round(stats.hasLastSoldPrice/result.rows.length*100)}%)`);
    console.log(`  Year Built: ${stats.hasYearBuilt}/${result.rows.length} (${Math.round(stats.hasYearBuilt/result.rows.length*100)}%)`);
    console.log(`  Land Area: ${stats.hasLandArea}/${result.rows.length} (${Math.round(stats.hasLandArea/result.rows.length*100)}%)`);
    console.log(`  Floor Size: ${stats.hasFloorSize}/${result.rows.length} (${Math.round(stats.hasFloorSize/result.rows.length*100)}%)`);
    console.log(`  Image: ${stats.hasImage}/${result.rows.length} (${Math.round(stats.hasImage/result.rows.length*100)}%)`);
    
    // Check address format issue
    console.log('\n🔍 Analyzing address format...');
    const sampleAddress = result.rows[0].address;
    console.log(`\nSample address: "${sampleAddress}"`);
    const parts = sampleAddress.split(' ');
    console.log(`Address parts (${parts.length}):`, parts);
    
    if (parts.length > 10) {
      console.log('\n⚠️  Issue detected: Address contains extra ID at the end');
      console.log('   The last number appears to be a property ID that should be removed');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await louisPool.end();
  }
}

checkAlbanyProperties();
