/* eslint-disable @typescript-eslint/no-require-imports */
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://nzmarie:HHa_pWigbE_OcEX83FNRPg@baby-centaur-27756.j77.aws-ap-southeast-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full'
});

async function queryAllDetails() {
  try {
    await client.connect();
    
    console.log('╔═══════════════════════════════════════════════════════════════════════╗');
    console.log('║          #26 Helen Ryburn Place - 数据库完整状态分析                 ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');
    
    // 1. 查询outreach_properties表中所有相关记录
    console.log('【1】outreach_properties 表中的所有记录:\n');
    const opResult = await client.query(
      `SELECT 
        id,
        property_address,
        suburb,
        status,
        sent_at,
        last_sent_at,
        total_send_count,
        campaign,
        property_id,
        created_at,
        updated_at
      FROM outreach_properties 
      WHERE property_address ILIKE $1 
      ORDER BY created_at DESC`,
      ['%26 Helen Ryburn%']
    );
    
    if (opResult.rows.length === 0) {
      console.log('❌ 未找到任何outreach_properties记录\n');
    } else {
      console.log(`✓ 找到 ${opResult.rows.length} 条记录:\n`);
      opResult.rows.forEach((row, idx) => {
        console.log(`记录 ${idx + 1}:`);
        console.log(`  ID: ${row.id}`);
        console.log(`  地址: ${row.property_address}`);
        console.log(`  小区: ${row.suburb}`);
        console.log(`  状态(status): ${row.status}`);
        console.log(`  发送次数: ${row.total_send_count}`);
        console.log(`  最后发送时间: ${row.last_sent_at}`);
        console.log(`  初始发送时间: ${row.sent_at}`);
        console.log(`  活动: ${row.campaign}`);
        console.log(`  property_id: ${row.property_id}`);
        console.log(`  创建时间: ${row.created_at}`);
        console.log(`  更新时间: ${row.updated_at}`);
        console.log('');
      });
    }
    
    // 2. 查询properties表中的信息（包括no_junk_mail标志）
    console.log('\n【2】Properties 表中对应的记录:\n');
    const pResult = await client.query(
      `SELECT 
        p.id,
        p.address,
        p.suburb,
        p.no_junk_mail,
        p.latitude,
        p.longitude,
        p.created_at
      FROM properties p
      WHERE p.address ILIKE $1
      ORDER BY p.created_at DESC`,
      ['%26 Helen Ryburn%']
    );
    
    if (pResult.rows.length === 0) {
      console.log('❌ 未找到properties表中的记录\n');
    } else {
      console.log(`✓ 找到 ${pResult.rows.length} 条记录:\n`);
      pResult.rows.forEach((row, idx) => {
        console.log(`记录 ${idx + 1}:`);
        console.log(`  ID: ${row.id}`);
        console.log(`  地址: ${row.address}`);
        console.log(`  小区: ${row.suburb}`);
        console.log(`  无垃圾邮件标志 (no_junk_mail): ${row.no_junk_mail ? '✓ TRUE (会显示为黄色)' : '✗ FALSE'}`);
        console.log(`  坐标: ${row.latitude}, ${row.longitude}`);
        console.log(`  创建时间: ${row.created_at}`);
        console.log('');
      });
    }
    
    // 3. 查询send_logs中的发送历史
    console.log('\n【3】发送日志 (outreach_send_logs):\n');
    const slResult = await client.query(
      `SELECT 
        osl.id,
        osl.outreach_property_id,
        osl.suburb,
        osl.campaign_key,
        osl.sent_at,
        osl.sent_by,
        osl.notes,
        op.property_address,
        op.status
      FROM outreach_send_logs osl
      LEFT JOIN outreach_properties op ON osl.outreach_property_id = op.id
      WHERE op.property_address ILIKE $1
      ORDER BY osl.sent_at DESC`,
      ['%26 Helen Ryburn%']
    );
    
    if (slResult.rows.length === 0) {
      console.log('❌ 未找到任何发送日志\n');
    } else {
      console.log(`✓ 找到 ${slResult.rows.length} 条发送日志:\n`);
      slResult.rows.forEach((row, idx) => {
        console.log(`日志 ${idx + 1}:`);
        console.log(`  日志ID: ${row.id}`);
        console.log(`  Property ID: ${row.outreach_property_id}`);
        console.log(`  地址: ${row.property_address}`);
        console.log(`  当前状态: ${row.status}`);
        console.log(`  发送时间: ${row.sent_at}`);
        console.log(`  发送活动: ${row.campaign_key}`);
        console.log(`  发送者: ${row.sent_by}`);
        console.log('');
      });
    }
    
    // 4. 联合查询 - 显示完整的关联数据
    console.log('\n【4】联合关联数据（用于Map渲染）:\n');
    const joinResult = await client.query(
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
        p.longitude,
        COUNT(DISTINCT osl.id) as send_log_count
      FROM outreach_properties op
      LEFT JOIN properties p ON REPLACE(op.property_id::text, '-', '') = p.id
      LEFT JOIN outreach_send_logs osl ON osl.outreach_property_id = op.id
      WHERE op.property_address ILIKE $1
      GROUP BY op.id, p.id, p.no_junk_mail, p.latitude, p.longitude
      ORDER BY op.created_at DESC`,
      ['%26 Helen Ryburn%']
    );
    
    if (joinResult.rows.length === 0) {
      console.log('❌ 未找到关联数据\n');
    } else {
      console.log(`✓ 找到 ${joinResult.rows.length} 条完整关联数据:\n`);
      joinResult.rows.forEach((row, idx) => {
        console.log(`关联数据 ${idx + 1}:`);
        console.log(`  Outreach Property ID: ${row.id}`);
        console.log(`  地址: ${row.property_address}`);
        console.log(`  小区: ${row.suburb}`);
        console.log(`  状态: ${row.status}`);
        console.log(`  无垃圾邮件: ${row.no_junk_mail}`);
        console.log(`  发送日志数: ${row.send_log_count}`);
        console.log(`  总发送次数: ${row.total_send_count}`);
        console.log(`  坐标: ${row.latitude}, ${row.longitude}`);
        console.log('');
        
        // 显示Map会如何渲染这个地址
        console.log('  【Map渲染结果】:');
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
        
        console.log(`    状态: ${statusDisplay}`);
        console.log(`    颜色: ${colorMap[statusDisplay]}`);
        console.log(`    原因: ${row.no_junk_mail ? 'no_junk_mail=true' : (row.status === 'sent' || row.total_send_count > 0 ? '已发送' : '未发送')}`);
        console.log('');
      });
    }
    
  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await client.end();
  }
}

queryAllDetails();
