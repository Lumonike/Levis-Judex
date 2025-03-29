module.exports = {
    apps : [{
        name   : "online-judge",
        script : "src/server.js",
        watch: ["src"],
        out_file: "./logs/console.log",
        error_file: "./logs/error.log",
        time: true
    }]
}
