import express from 'express';
import { getDb } from './db.js';
import { authenticateToken } from '../src/middleware/auth.js';

const router = express.Router();

/**
 * @openapi
 * /api/users/profile:
 *   get:
 *     tags: [Users]
 *     summary: Get current user profile
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     uid:
 *                       type: string
 *                     email:
 *                       type: string
 *                     displayName:
 *                       type: string
 *                     photoURL:
 *                       type: string
 *                     favorites:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const usersCollection = db.collection('users');
    
    // Find or create user
    let user = await usersCollection.findOne({ uid: req.user.uid });
    
    if (!user) {
      // Create new user
      user = {
        uid: req.user.uid,
        email: req.user.email,
        displayName: req.user.name,
        photoURL: req.user.picture,
        favorites: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await usersCollection.insertOne(user);
    } else {
      // Update photoURL if it's missing but available in Firebase token
      if (!user.photoURL && req.user.picture) {
        await usersCollection.updateOne(
          { uid: req.user.uid },
          { 
            $set: { 
              photoURL: req.user.picture,
              updatedAt: new Date()
            } 
          }
        );
        user.photoURL = req.user.picture;
      }
    }

    res.json({
      success: true,
      data: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        favorites: user.favorites || [],
      },
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile',
    });
  }
});

/**
 * @openapi
 * /api/users/profile:
 *   put:
 *     tags: [Users]
 *     summary: Update user profile
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *               photoURL:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { displayName, photoURL } = req.body;
    const db = await getDb();
    const usersCollection = db.collection('users');
    
    const updateData = {
      updatedAt: new Date(),
    };
    
    if (displayName !== undefined) updateData.displayName = displayName;
    if (photoURL !== undefined) updateData.photoURL = photoURL;
    
    await usersCollection.updateOne(
      { uid: req.user.uid },
      { 
        $set: updateData,
        $setOnInsert: {
          uid: req.user.uid,
          email: req.user.email,
          favorites: [],
          createdAt: new Date(),
        }
      },
      { upsert: true }
    );

    res.json({
      success: true,
      data: { message: 'Profile updated successfully' },
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
    });
  }
});

/**
 * @openapi
 * /api/users/favorites:
 *   get:
 *     tags: [Users]
 *     summary: Get user's favorite motorcycles
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of favorite motorcycle IDs
 */
router.get('/favorites', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const usersCollection = db.collection('users');
    
    let user = await usersCollection.findOne({ uid: req.user.uid });

    if (!user) {
      const now = new Date();
      const newUser = {
        uid: req.user.uid,
        email: req.user.email || null,
        displayName: req.user.name || null,
        photoURL: req.user.picture || null,
        favorites: [],
        createdAt: now,
        updatedAt: now,
      };

      await usersCollection.insertOne(newUser);
      user = newUser;
    }

    const favorites = Array.isArray(user?.favorites)
      ? user.favorites.filter((id) => typeof id === 'string' && id.trim().length > 0)
      : [];

    res.json({
      success: true,
      data: favorites,
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch favorites',
    });
  }
});

/**
 * @openapi
 * /api/users/favorites:
 *   post:
 *     tags: [Users]
 *     summary: Add a motorcycle to favorites
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bikeId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Favorite added successfully
 */
router.post('/favorites', authenticateToken, async (req, res) => {
  try {
    const { bikeId } = req.body;
    
    if (!bikeId) {
      return res.status(400).json({
        success: false,
        error: 'bikeId is required',
      });
    }

    const db = await getDb();
    const usersCollection = db.collection('users');
    
    // Add to favorites (avoid duplicates with $addToSet)
    await usersCollection.updateOne(
      { uid: req.user.uid },
      { 
        $addToSet: { favorites: bikeId },
        $set: { updatedAt: new Date() },
        $setOnInsert: {
          uid: req.user.uid,
          email: req.user.email,
          displayName: req.user.name,
          photoURL: req.user.picture,
          createdAt: new Date(),
        }
      },
      { upsert: true }
    );

    // Fetch updated favorites
    const user = await usersCollection.findOne({ uid: req.user.uid });
    const favorites = Array.isArray(user?.favorites)
      ? user.favorites.filter((id) => typeof id === 'string' && id.trim().length > 0)
      : [];

    res.json({
      success: true,
      data: { 
        message: 'Added to favorites',
        favorites,
      },
    });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add favorite',
    });
  }
});

/**
 * @openapi
 * /api/users/favorites/{bikeId}:
 *   delete:
 *     tags: [Users]
 *     summary: Remove a motorcycle from favorites
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bikeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Favorite removed successfully
 */
router.delete('/favorites/:bikeId', authenticateToken, async (req, res) => {
  try {
    const { bikeId } = req.params;
    const db = await getDb();
    const usersCollection = db.collection('users');
    
    await usersCollection.updateOne(
      { uid: req.user.uid },
      { 
        $pull: { favorites: bikeId },
        $set: { updatedAt: new Date() }
      }
    );

    // Fetch updated favorites
    const user = await usersCollection.findOne({ uid: req.user.uid });
    const favorites = Array.isArray(user?.favorites)
      ? user.favorites.filter((id) => typeof id === 'string' && id.trim().length > 0)
      : [];

    res.json({
      success: true,
      data: { 
        message: 'Removed from favorites',
        favorites,
      },
    });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove favorite',
    });
  }
});

/**
 * @openapi
 * /api/users/favorites/sync:
 *   post:
 *     tags: [Users]
 *     summary: Merge local favorites with server account
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               favorites:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Favorites synced successfully
 */
router.post('/favorites/sync', authenticateToken, async (req, res) => {
  try {
    const { favorites } = req.body;

    if (!Array.isArray(favorites)) {
      return res.status(400).json({
        success: false,
        error: 'favorites must be an array',
      });
    }

    const sanitizedFavorites = favorites.filter(
      (id) => typeof id === 'string' && id.trim().length > 0
    );

    const db = await getDb();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ uid: req.user.uid });
    const existingFavorites = Array.isArray(user?.favorites)
      ? user.favorites.filter((id) => typeof id === 'string' && id.trim().length > 0)
      : [];

    const mergedFavorites = [...new Set([...existingFavorites, ...sanitizedFavorites])];

    const updateData = {
      favorites: mergedFavorites,
      updatedAt: new Date(),
    };

    if (!user?.displayName && req.user.name) {
      updateData.displayName = req.user.name;
    }

    if (!user?.photoURL && req.user.picture) {
      updateData.photoURL = req.user.picture;
    }

    if (!user?.email && req.user.email) {
      updateData.email = req.user.email;
    }

    await usersCollection.updateOne(
      { uid: req.user.uid },
      {
        $set: updateData,
        $setOnInsert: {
          uid: req.user.uid,
          email: req.user.email || null,
          displayName: req.user.name || null,
          photoURL: req.user.picture || null,
          favorites: mergedFavorites,
          createdAt: new Date(),
        }
      },
      { upsert: true }
    );

    res.json({
      success: true,
      data: {
        message: 'Favorites synced successfully',
        favorites: mergedFavorites,
      },
    });
  } catch (error) {
    console.error('Error syncing favorites:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync favorites',
    });
  }
});

export default router;
