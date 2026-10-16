/* eslint-disable @typescript-eslint/no-require-imports */
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://nzmarie:HHa_pWigbE_OcEX83FNRPg@baby-centaur-27756.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full'
});

async function analyzeMapQuery() {
  try {
    await client.connect();
    
    console.log('╔═══════════════════════════════════════════════════════════════════════╗');
    console.log('║         #26 Helen Ryburn Place - Map查询详细分析                     ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');
    
    // 首先找出该地址所在的街道
    const streetResult = await client.query(
      `SELECT DISTINCT 
        op.street,
        op.house_number,
        op.suburb
      FROM outreach_properties op
      WHERE op.property_address ILIKE $1`,
      ['%26 Helen Ryburn%']
    );
    
    if (streetResult.rows.length === 0) {
      console.log('❌ 未找到街道信息');
      await client.end();
      return;
    }
    
    const { street, house_number, suburb } = streetResult.rows[0];
    console.log(`【0】基本信息:`);
    console.log(`  街道: ${street}`);
    console.log(`  门牌号: ${house_number}`);
    console.log(`  小区: ${suburb}\n`);
    
    // 查询该街道上的所有地址及其状态
    console.log(`【1】该街道 "${street}" 上的所有地址\n`);
    const streetAddressesResult = await client.query(
      `SELECT 
        op.id,
        op.property_address,
        op.suburb,
        op.status,
        op.sent_at,
        op.last_sent_at,
        op.total_send_count,
        p.no_junk_mail,
        p.latitude,
        p.longitude
      FROM outreach_properties op
      LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
      WHERE op.street ILIKE $1 AND op.suburb = $2
      ORDER BY op.house_number ASC NULLS LAST, op.property_address ASC`,
      [street, suburb]
    );
    
    console.log(`找到 ${streetAddressesResult.rows.length} 个地址\n`);
    streetAddressesResult.rows.forEach((row, idx) => {
      const statusDisplay = row.no_junk_mail 
        ? 'junk' 
        : (row.total_send_count > 0 || row.last_sent_at != null || row.sent_at != null || row.status === 'sent')
          ? 'sent'
          : 'unsent';
      
      const colorMap = {
        junk: '🟡 黄色',
        sent: '🟣 紫色',
        unsent: '🔴 红色'
      };
      
      const highlight = row.property_address.includes('26 Helen Ryburn') ? ' ⭐ <<< #26 Helen Ryburn Place' : '';
      
      console.log(`${idx + 1}. ${row.property_address}${highlight}`);
      console.log(`   状态字段: ${row.status} | 无垃圾邮件: ${row.no_junk_mail} | 已发送: ${row.total_send_count}`);
      console.log(`   Map显示颜色: ${colorMap[statusDisplay]}`);
      console.log('');
    });
    
    // 现在查询Redis中缓存的数据
    console.log('\n【2】分析街道汇总查询 (用于Map)\n');
    
    // 模拟street-clusters路由的过滤逻辑
    // 对于status='sent'的查询
    console.log('情景1: 查询 status=sent 的地址\n');
    const sentResult = await client.query(
      `SELECT 
        op.id,
        op.property_address,
        op.status,
        op.total_send_count,
        op.last_sent_at,
        op.sent_at,
        p.no_junk_mail
      FROM outreach_properties op
      LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
      WHERE op.street ILIKE $1 
        AND op.suburb = $2 
        AND op.status = $3
        AND op.street IS NOT NULL 
        AND TRIM(op.street) <> ''
      ORDER BY op.property_address ASC`,
      [street, suburb, 'sent']
    );
    
    console.log(`  ✓ 找到 ${sentResult.rows.length} 条记录`);
    sentResult.rows.forEach(row => {
      console.log(`    - ${row.property_address}${row.property_address.includes('26 Helen Ryburn') ? ' ⭐' : ''}`);
    });
    
    // 对于status='pending'的查询
    console.log('\n情景2: 查询 status=pending 的地址\n');
    const pendingResult = await client.query(
      `SELECT 
        op.id,
        op.property_address,
        op.status,
        op.total_send_count,
        op.last_sent_at,
        op.sent_at,
        p.no_junk_mail
      FROM outreach_properties op
      LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
      WHERE op.street ILIKE $1 
        AND op.suburb = $2 
        AND op.status = $3
        AND op.street IS NOT NULL 
        AND TRIM(op.street) <> ''
      ORDER BY op.property_address ASC`,
      [street, suburb, 'pending']
    );
    
    console.log(`  ✓ 找到 ${pendingResult.rows.length} 条记录`);
    pendingResult.rows.forEach(row => {
      console.log(`    - ${row.property_address}${row.property_address.includes('26 Helen Ryburn') ? ' ⭐' : ''}`);
    });
    
    // 对于status='junk'的查询
    console.log('\n情景3: 查询 status=junk 的地址\n');
    const junkResult = await client.query(
      `SELECT 
        op.id,
        op.property_address,
        op.status,
        op.total_send_count,
        op.last_sent_at,
        op.sent_at,
        p.no_junk_mail
      FROM outreach_properties op
      LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
      WHERE op.street ILIKE $1 
        AND op.suburb = $2 
        AND op.status = $3
        AND op.street IS NOT NULL 
        AND TRIM(op.street) <> ''
      ORDER BY op.property_address ASC`,
      [street, suburb, 'junk']
    );
    
    console.log(`  ✓ 找到 ${junkResult.rows.length} 条记录`);
    junkResult.rows.forEach(row => {
      console.log(`    - ${row.property_address}${row.property_address.includes('26 Helen Ryburn') ? ' ⭐' : ''}`);
    });
    
    // 总结
    console.log('\n【3】问题诊断:\n');
    console.log(`街道 "${street}" 在Torbay小区:`);
    console.log(`  - 总地址数: ${streetAddressesResult.rows.length}`);
    console.log(`  - sent状态: ${sentResult.rows.length} 条`);
    console.log(`  - pending状态: ${pendingResult.rows.length} 条`);
    console.log(`  - junk状态: ${junkResult.rows.length} 条`);
    console.log('');
    
    if (sentResult.rows.some(r => r.property_address.includes('26 Helen Ryburn'))) {
      console.log('✓ #26 Helen Ryburn Place 在 sent 列表中');
    }
    if (pendingResult.rows.some(r => r.property_address.includes('26 Helen Ryburn'))) {
      console.log('⚠️  #26 Helen Ryburn Place 也在 pending 列表中 (重复!)');
    }
    if (junkResult.rows.some(r => r.property_address.includes('26 Helen Ryburn'))) {
      console.log('⚠️  #26 Helen Ryburn Place 也在 junk 列表中 (不应该!)');
    }
    
  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await client.end();
  }
}

analyzeMapQuery();
