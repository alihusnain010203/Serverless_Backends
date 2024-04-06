import { Hono } from 'hono'
import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';
import { cors } from 'hono/cors';
import { decode, sign, verify } from 'hono/jwt';

const app = new Hono<{
  Bindings: {
    DATABASE_URL: string;
    JWT_SECERT: string;
  }
}>();

// Middleware for verifying token to go blog routes


app.use('/*', cors());

app.use('/api/v1/blog/*', async (c, next) => {

  const header = c.req.header('Authorization');

  const token = header?.split(' ')[1];
  if (!token) {
    return c.json({ message: 'No token provided' });
  }

  const res = await verify(token, c.env.JWT_SECERT);

  if (res.id) {
    c.set("jwtPayload", { userId: res.id });
    await next();
  }
  else {
    return c.json({ message: 'Invalid token' });
  }
})
// Prisma Client
app.get('/', (c) => {
  console.log(c.env)

  return c.text('Hello Hono!')
})
// .Signup route
app.post('/api/v1/user/signup', async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());
  const body = await c.req.json();
  const user = await prisma.user.create({
    data: {
      email: body.email,
      password: body.password,
      name: body.name,
    }
  })

  const token = await sign({ id: user.id }, c.env.JWT_SECERT);

  return c.json({ message: 'User created', token: token, userId: user.id });

})

// SignIn route

app.post('/api/v1/user/signin', async (c) => {
  const body = await c.req.json();

  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  const user = await prisma.user.findUnique({
    where: {
      email: body.email,
    }

  });
  if (!user) {
    return c.json({ message: 'User not found' });
  }
  if (user.password !== body.password) {
    return c.json({ message: 'Invalid password' });
  }
  const token = await sign({ id: user.id }, c.env.JWT_SECERT);
  return c.json({ message: 'User signed in', token });
})




// Post Blog route

app.post('/api/v1/blog/post', async (c) => {

  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  const body = await c.req.json();

  const blog = await prisma.post.create({
    data: {
      title: body.title,
      content: body.content,
      authorId: c.get("jwtPayload").userId
    }

  })

  return c.json({ message: 'Blog posted successfully', blogId: blog.id });
})

// Put Blog route

app.put('/api/v1/blog/update', async (c) => {
  // Intiallize Prisma Client
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());
  // Update blog using blog id

  const body = await c.req.json();

  const blog = await prisma.post.update({
    where: {
      id: body.id
    },
    data: {
      title: body.title,
      content: body.content,
    }
  })






  return c.json({ message: 'Blog updated successfully', blog: blog });
})

// Get one blog route

app.get('/api/v1/blog/:id', async (c) => {

  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate());

  const id = c.req.param("id");

  const blog = await prisma.post.findUnique({
    where: {
      id: id
    }
  })

  if (!blog) {
    return c.json({ message: 'Blog not found' });
  }

  return c.json({ message: 'Blog fetched successfully', blog: blog });
})

// bulk fetch blogs route

app.get('/api/v1/blogs/bulk', async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env.DATABASE_URL,
  }).$extends(withAccelerate())
  const blogs = await prisma.post.findMany({
    select: {
      content: true,
      title: true,
      id: true,
      author: {
        select: {
          name: true
        }
      }
    }
  });

  return c.json({
    blogs
  })
})


export default app
