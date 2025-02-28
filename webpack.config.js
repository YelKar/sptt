const path = require('path');

module.exports = {
    entry: './script.js', // Главный файл
    output: {
        filename: 'sptt.js', // Имя выходного JS-файла
        path: path.resolve(__dirname, ''), // Папка для результата
    },
    mode: 'production', // Режим production для минификации
    module: {
        rules: [
            {
                test: /\.js$/, // Обрабатываем все .js файлы
                exclude: /node_modules/, // Исключаем папку node_modules
                type: 'javascript/auto',
                use: {
                    loader: 'babel-loader', // Используем babel-loader
                    options: {
                        presets: ['@babel/preset-env'],
                    },
                },
            },
            {
                test: /\.css$/, // Обрабатываем все .css файлы
                use: [
                    'style-loader', // Встраивает CSS в <style> теги
                    'css-loader', // Загружает CSS
                ],
            },
        ],
    },
};