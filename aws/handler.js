const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client();

module.exports.sync = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { deviceId, records } = body;
    
    if (!deviceId || !records || !Array.isArray(records)) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Invalid payload' }) };
    }

    for (const record of records) {
      const key = `${deviceId}/${new Date().toISOString().split('T')[0]}/${record.record_id}.json`;
      const command = new PutObjectCommand({
        Bucket: 'attendance-records-netra',
        Key: key,
        Body: JSON.stringify(record),
        ContentType: 'application/json'
      });
      await s3.send(command);
    }
    
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Sync successful', syncedRecords: records.length })
    };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) };
  }
};
