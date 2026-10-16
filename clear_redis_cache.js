/* eslint-disable @typescript-eslint/no-require-imports */
const Redis = require('ioredis');

const redis = new Redis({
  host: 'default-db-6f0db87.upstash.io',
  port: 6379,
  password: 'AXY8AAIjcDEwNDE0MzQ4OGU2NzQ0MjZiNGVkZTdjZjMyOWQ0YzEzZABwNw==',
  tls: true,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

async function clearOutreachCache() {
  try {
    console.log('╔═══════════════════════════════════════════════════════════════════════╗');
    console.log('║              清除Outreach Map相关的Redis缓存                        ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════╝\n');
    
    // 获取所有street-clusters相关的key
    console.log('【1】搜索所有street-clusters缓存key\n');
    
    const pattern = 'street-clusters:*';
    const keys = await redis.keys(pattern);
    
    console.log(`  找到 ${keys.length} 个street-clusters缓存key\n`);
    
    if (keys.length > 0) {
      console.log('  要删除的key:');
      keys.forEach(key => {
        console.log(`    - ${key}`);
      });
      console.log('');
      
      // 删除所有匹配的key
      const deletedCount = await redis.del(...keys);
      console.log(`  ✓ 已删除 ${deletedCount} 个key\n`);
    }
    
    // 特别检查Torbay街道的缓存
    console.log('【2】检查Torbay suburb的specific缓存\n');
    
    const torbayPattern = 'street-clusters:torbay*';
    const torbayKeys = await redis.keys(torbayPattern);
    
    console.log(`  Torbay相关key: ${torbayKeys.length} 个`);
    if (torbayKeys.length > 0) {
      torbayKeys.forEach(key => {
        console.log(`    - ${key}`);
      });
      const deleted2 = await redis.del(...torbayKeys);
      console.log(`    ✓ 已删除 ${deleted2} 个\n`);
    }
    
    console.log('【3】验证Helen Ryburn缓存已清除\n');
    
    // 尝试查询Helen Ryburn相关的缓存
    const allKeys = await redis.keys('*helen*');
    console.log(`  仍有的helen相关key: ${allKeys.length} 个`);
    if (allKeys.length > 0) {
      console.log('  注意: 这些可能是不相关的key');
      allKeys.forEach(key => {
        console.log(`    - ${key}`);
      });
    }
    
    console.log('\n【完成】');
    console.log('✓ Redis缓存已清除');
    console.log('✓ 下次调用API会获取最新数据库状态');
    console.log('✓ 用户应该清除浏览器缓存(Ctrl+Shift+Delete)后刷新页面');
    
  } catch (err) {
    console.error('❌ 错误:', err.message);
  } finally {
    await redis.quit();
  }
}

clearOutreachCache();
