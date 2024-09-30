const express = require('express');
const app = express();
const port = 3000;
const mariadb = require('mariadb');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const sanitizeHtml = require('sanitize-html');

app.use(express.json());

const pool = mariadb.createPool({
  host: 'localhost',
  user: 'root',
  password: 'officiaL_2000k',
  database: 'sample',
  port: 3306,
  connectionLimit: 10
});

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Books and Authors API',
      version: '1.0.0',
    },
  },
  apis: ['./testserver.js'], // path to the my API
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

/**
 * @swagger
 * /books:
 *   get:
 *     summary: Retrieve all books
 *     responses:
 *       200:
 *         description: A list of books
 */
app.get('/books', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query('SELECT * FROM books');
    res.setHeader('Content-Type', 'application/json');
    res.json(rows);
  } catch (err) {
    console.error('Error in /books:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * @swagger
 * /books/{id}:
 *   get:
 *     summary: Retrieve a book by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: A book object
 *       404:
 *         description: Book not found
 */
app.get('/books/:id', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query('SELECT * FROM books WHERE id = ?', [req.params.id]);
    res.setHeader('Content-Type', 'application/json');
    if (rows.length === 0) {
      res.status(404).json({ error: 'Book not found' });
    } else {
      res.json(rows[0]);
    }
  } catch (err) {
    console.error('Error in /books/:id:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * @swagger
 * /authors:
 *   get:
 *     summary: Retrieve all authors
 *     responses:
 *       200:
 *         description: A list of authors
 */
app.get('/authors', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query('SELECT DISTINCT author FROM books');
    res.setHeader('Content-Type', 'application/json');
    res.json(rows);
  } catch (err) {
    console.error('Error in /authors:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * @swagger
 * /authors/{id}:
 *   get:
 *     summary: Retrieve an author by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: An author object
 *       404:
 *         description: Author not found
 */
app.get('/authors/:id', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query('SELECT * FROM authors WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Author not found' });
    } else {
      res.json(rows[0]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * @swagger
 * /books:
 *   post:
 *     summary: Create a new book
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               author:
 *                 type: string
 *               published_year:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Book created successfully
 */
app.post('/books', async (req, res) => {
  let conn;
  try {
    // Sanitization
    const title = sanitizeHtml(req.body.title);
    const author = sanitizeHtml(req.body.author);
    const published_year = parseInt(req.body.published_year);

    // Validation
    if (!title || !author || isNaN(published_year)) {
      return res.status(400).json({ error: 'Title, author, and published year are required' });
    }
    if (published_year < 0 || published_year > new Date().getFullYear()) {
      return res.status(400).json({ error: 'Invalid published year' });
    }

    conn = await pool.getConnection();
    const result = await conn.query(
      'INSERT INTO books (title, author, published_year) VALUES (?, ?, ?)',
      [title, author, published_year]
    );

    // Convert BigInt to number before sending it in the response
    const insertId = Number(result.insertId);

    res.status(201).json({ message: 'Book created successfully', id: insertId });
  } catch (err) {
    console.error('Error in POST /books:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * @swagger
 * /books/{id}:
 *   patch:
 *     summary: Update a book partially
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               author:
 *                 type: string
 *               published_year:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Book updated successfully
 */
app.patch('/books/:id', async (req, res) => {
  let conn;
  try {
    const id = parseInt(req.params.id);
    const updates = {};

    if (req.body.title) updates.title = sanitizeHtml(req.body.title);
    if (req.body.author) updates.author = sanitizeHtml(req.body.author);
    if (req.body.published_year) {
      const year = parseInt(req.body.published_year);
      if (year < 0 || year > new Date().getFullYear()) {
        return res.status(400).json({ error: 'Invalid published year' });
      }
      updates.published_year = year;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    conn = await pool.getConnection();
    const query = 'UPDATE books SET ? WHERE id = ?';
    await conn.query(query, [updates, id]);
    res.json({ message: 'Book updated successfully' });
  } catch (err) {
    console.error('Error in PATCH /books/:id:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * @swagger
 * /books/{id}:
 *   put:
 *     summary: Replace a book
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               author:
 *                 type: string
 *               published_year:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Book replaced successfully
 */
app.put('/books/:id', async (req, res) => {
  let conn;
  try {
    const id = parseInt(req.params.id);
    const title = sanitizeHtml(req.body.title);
    const author = sanitizeHtml(req.body.author);
    const published_year = parseInt(req.body.published_year);

    if (!title || !author || !published_year) {
      return res.status(400).json({ error: 'Title, author, and published year are required' });
    }
    if (published_year < 0 || published_year > new Date().getFullYear()) {
      return res.status(400).json({ error: 'Invalid published year' });
    }

    conn = await pool.getConnection();
    const query = 'UPDATE books SET title = ?, author = ?, published_year = ? WHERE id = ?';
    await conn.query(query, [title, author, published_year, id]);
    res.json({ message: 'Book replaced successfully' });
  } catch (err) {
    console.error('Error in PUT /books/:id:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (conn) conn.release();
  }
});

/**
 * @swagger
 * /books/{id}:
 *   delete:
 *     summary: Delete a book
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Book deleted successfully
 */
app.delete('/books/:id', async (req, res) => {
  let conn;
  try {
    const id = parseInt(req.params.id);
    conn = await pool.getConnection();
    await conn.query('DELETE FROM books WHERE id = ?', [id]);
    res.sendStatus(204);
  } catch (err) {
    console.error('Error in DELETE /books/:id:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (conn) conn.release();
  }
});

app.listen(port, () => {
  console.log(`Server running at http://137.184.101.63:${3000}`);
  console.log(`Swagger UI available at http://137.184.101.63:${3000}/api-docs`);
});
