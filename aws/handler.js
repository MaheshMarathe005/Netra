const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const s3 = new S3Client();

module.exports.sync = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const { deviceId, records } = body;
    
    if (!deviceId || !records || !Array.isArray(records)) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Invalid payload' }) };
    }

    for (const record of records) {
      // Store everything in the requested single folder, using serial timestamps to prevent overwrites
      const type = record.type || 'ATTENDANCE';
      const rawName = record.personnel_name || record.name || 'UnknownUser';
      const safeName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      // Format: all_users_data/Mahesh_ATTENDANCE_2026-06-04...json
      const key = `all_users_data/${safeName}_${type}_${timestamp}.json`;
      const command = new PutObjectCommand({
        Bucket: 'attendance-records-netra-virginia',
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

module.exports.getPersonnel = async (event) => {
  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: 'attendance-records-netra-virginia',
      Prefix: 'all_users_data/'
    });
    const listResult = await s3.send(listCommand);
    
    const personnel = [];
    if (listResult.Contents) {
      for (const item of listResult.Contents) {
        if (!item.Key.includes('_PERSONNEL_')) continue;
        const getCommand = new GetObjectCommand({
          Bucket: 'attendance-records-netra-virginia',
          Key: item.Key
        });
        const getResult = await s3.send(getCommand);
        const str = await getResult.Body.transformToString();
        personnel.push(JSON.parse(str));
      }
    }
    
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ personnel })
    };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ message: 'Internal Server Error' }) };
  }
};
