module.exports = {
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    extends: [],
    env: {
        node: true
    },
    globals: {},
    "parserOptions": {
        "ecmaVersion": 6,
        "sourceType": "module",
        "ecmaFeatures": {
          "modules": true
        }
    },
    rules: {
        // 这里填入你的项目需要的个性化配置
        semi:["error", "never"],
        quotes:["error", "double"]
    }
};