/* eslint-disable @typescript-eslint/no-require-imports */
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://nzmarie:HHa_pWigbE_OcEX83FNRPg@baby-centaur-27756.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full'
});

async function checkDuplicateAddresses() {
  try {
    await client.connect();
    
    console.log('╔═══════════════════════════════════════════════════════════════════════╗');
    console.log('║   检查：26 Helen Ryburn Place 是否在API响应中出现多次              ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');
    
    // 模拟street-clusters API的查询逻辑
    console.log('【场景1】查询 status=pending + sent_status=unsent (TodayRun默认设置)\n');
    
    const result1 = await client.query(
      `SELECT 
        op.id,
        op.property_address,
        op.status,
        COUNT(*) as duplicate_count,
        array_agg(DISTINCT p.id) as property_ids,
        array_agg(DISTINCT p.latitude) as latitudes,
        array_agg(DISTINCT p.longitude) as longitudes
      FROM outreach_properties op
      LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
      WHERE op.property_address = $1
        AND op.suburb = $2
        AND op.status = $3
      GROUP BY op.id, op.property_address, op.status
      HAVING COUNT(*) > 1 OR COUNT(DISTINCT p.id) > 1
      ORDER BY op.property_address ASC`,
      ['26 Helen Ryburn Place', 'Torbay', 'pending']
    );
    
    console.log(`  ✓ 找到 ${result1.rows.length} 条记录`);
    if (result1.rows.length > 0) {
      console.log(`  ⚠️  警告: 检测到重复！`);
      result1.rows.forEach((row, idx) => {
        console.log(`    记录 ${idx + 1}:`);
        console.log(`      地址: ${row.property_address}`);
        console.log(`      ID: ${row.id}`);
        console.log(`      重复次数: ${row.duplicate_count}`);
        console.log(`      Property IDs: ${row.property_ids}`);
        console.log('');
      });
    } else {
      console.log(`  ✓ 无重复 (记录只出现一次或不存在)\n`);
    }
    
    // 检查sent状态
    console.log('【场景2】查询 status=sent\n');
    
    const result2 = await client.query(
      `SELECT 
        op.id,
        op.property_address,
        op.status,
        COUNT(*) as duplicate_count,
        array_agg(DISTINCT p.id) as property_ids
      FROM outreach_properties op
      LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
      WHERE op.property_address = $1
        AND op.suburb = $2
        AND op.status = $3
      GROUP BY op.id, op.property_address, op.status
      HAVING COUNT(*) > 1 OR COUNT(DISTINCT p.id) > 1
      ORDER BY op.property_address ASC`,
      ['26 Helen Ryburn Place', 'Torbay', 'sent']
    );
    
    console.log(`  ✓ 找到 ${result2.rows.length} 条记录`);
    if (result2.rows.length > 0) {
      console.log(`  ⚠️  警告: 检测到重复！`);
      result2.rows.forEach((row) => {
        console.log(`    地址: ${row.property_address}`);
        console.log(`    ID: ${row.id}`);
        console.log(`    重复次数: ${row.duplicate_count}`);
        console.log(`    Property IDs: ${row.property_ids}`);
      });
    } else {
      console.log(`  ✓ 无重复\n`);
    }
    
    // 检查是否有多个outreach_properties记录指向同一个address
    console.log('【场景3】检查是否有多个outreach_properties记录对应同一地址\n');
    
    const result3 = await client.query(
      `SELECT 
        op.id,
        op.property_address,
        op.property_id,
        op.status,
        op.total_send_count,
        op.sent_at
      FROM outreach_properties op
      WHERE op.property_address = $1
        AND op.suburb = $2
      ORDER BY op.created_at DESC`,
      ['26 Helen Ryburn Place', 'Torbay']
    );
    
    console.log(`  ✓ 找到 ${result3.rows.length} 条outreach_properties记录\n`);
    result3.rows.forEach((row, idx) => {
      console.log(`  记录 ${idx + 1}:`);
      console.log(`    ID: ${row.id}`);
      console.log(`    Property ID: ${row.property_id}`);
      console.log(`    地址: ${row.property_address}`);
      console.log(`    状态: ${row.status}`);
      console.log(`    已发送: ${row.total_send_count > 0 ? '是' : '否'}`);
      console.log(`    发送时间: ${row.sent_at || '未发送'}`);
      console.log('');
    });
    
    // 如果有多条记录，检查property表中是否也有重复
    if (result3.rows.length > 1) {
      console.log('【场景4】多条outreach_properties记录 - 检查property表\n');
      
      const propIds = result3.rows.map(r => r.property_id).filter(id => id);
      if (propIds.length > 0) {
        const result4 = await client.query(
          `SELECT 
            id,
            address,
            no_junk_mail,
            latitude,
            longitude
          FROM properties
          WHERE id IN (${propIds.map((_, i) => `$${i + 1}`).join(',')})
          ORDER BY created_at DESC`,
          propIds
        );
        
        console.log(`  ✓ 对应的properties表记录: ${result4.rows.length}\n`);
        result4.rows.forEach((row, idx) => {
          console.log(`  Property ${idx + 1}:`);
          console.log(`    ID: ${row.id}`);
          console.log(`    地址: ${row.address}`);
          console.log(`    坐标: ${row.latitude}, ${row.longitude}`);
          console.log(`    No Junk Mail: ${row.no_junk_mail}`);
          console.log('');
        });
      }
    }
    
    // 最后，查看实际的API响应会如何构建addressCoords
    console.log('【结论】\n');
    if (result3.rows.length === 1) {
      console.log('✓ 数据库中只有1条outreach_properties记录');
      console.log('✓ 不应该出现重复的地址坐标');
      console.log('✓ 如果Map显示3种颜色，问题可能是：');
      console.log('  1. Redis缓存中的stale数据');
      console.log('  2. 浏览器缓存问题');
      console.log('  3. 用户误解 - 实际上是看同一街道上的不同地址');
    } else {
      console.log(`⚠️  警告: 数据库中有 ${result3.rows.length} 条outreach_properties记录！`);
      console.log('这会导致Map API返回重复的坐标和冲突的状态');
    }
    
  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await client.end();
  }
}

checkDuplicateAddresses();
