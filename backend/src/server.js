const app = require('./app');
const config = require('./config');

const PORT = config.port;

app.listen(PORT, () => {
    console.log(`🚀 Backend server listening on http://localhost:${PORT}`);
    console.log(`   Environment: ${config.nodeEnv}`);
});
