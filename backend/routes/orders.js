const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');

router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { customerName, items } = req.body;

    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ message: 'Customer name is required' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one order item is required' });
    }

    const normalizedItems = [];
    const productCache = new Map();

    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!item.productId || !Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ message: 'Each item needs a product and quantity of at least 1' });
      }

      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: 'One of the selected products was not found' });
      }

      if (product.stock < quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
      }

      productCache.set(String(product._id), product);
      normalizedItems.push({
        product: product._id,
        productName: product.name,
        unitPrice: product.price,
        quantity,
        lineTotal: product.price * quantity
      });
    }

    for (const item of normalizedItems) {
      const product = productCache.get(String(item.product));
      product.stock -= item.quantity;
      await product.save();
    }

    const totalAmount = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const order = await Order.create({
      customerName: customerName.trim(),
      items: normalizedItems,
      totalAmount
    });

    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;