### 环境要求
1. jdk 17
2. mysql 8.0
3. redis 版本 >= 5.X
4. maven 3.8+
5. nodejs 20+ & pnpm
6. neo4j 5.23
   
### 启动后端
1. 拉取代码文件
github:
https://github.com/plutoqz/ruoyi-b.git
gitee:
https://gitee.com/plutoqz/ruoyi-b.git
1. 设置好maven的安装文件夹
2. 修改xml文件中的各项配置，包括MySQL、Redis、Neo4j的端口、用户名和密码
3. 运行<span style="color: #ff0000">RuoYiAIApplication.java</span>
   
### 启动前端
1. 拉取代码文件
github:
https://github.com/plutoqz/ruoyi-f.git
gitee:
https://gitee.com/plutoqz/ruoyi-f.git
1. 终端输入`pnpm install`
2. 终端输入`npm run dev`，启动前端