const orderModel = require('../models/orderModel.js');
const userModel = require('../models/userModel.js');
const cartModel = require('../models/cartModel.js');
const productModel = require('../models/productModel.js');
const { isValidBody, isValidObjectId, isValidIncludes, isValid } = require('../util/validator.js');

//createOrder
const createOrder = async (req, res) => {
    try {
        const userId = req.params.userId;
        const reqBody = req.body;
        const { cartId, cancellable, status } = reqBody;

        if (!isValidBody(reqBody)) return res.status(400).send({ status: false, message: 'Please provide product details.' });
        if (!isValid(cartId)) return res.status(400).send({ status: false, message: 'Please enter cartId' });

        if (!isValidObjectId(userId)) return res.status(400).send({ status: false, message: `'${userId}' this userId invalid.` });
        if (!isValidObjectId(cartId)) return res.status(400).send({ status: false, message: 'cart id is not valid.' });

        //existUser
        const existUser = await userModel.findById(userId);
        if (!existUser) return res.status(404).send({ status: false, message: 'User not present.' });

        //existCart
        const existCart = await cartModel.findOne({ _id: cartId, userId: userId });
        if (!existCart) return res.status(404).send({ status: false, message: 'No cart found.' });

        let itemsArr = existCart.items;
        if (itemsArr.length === 0) return res.status(400).send({ status: false, message: 'Cart is empty.' });

        let sum = 0;
        for (let i of itemsArr) sum += i.quantity;

        let newData = {
            userId: userId,
            items: existCart.items,
            totalPrice: existCart.totalPrice,
            totalItems: existCart.totalItems,
            totalQuantity: sum
        };

        //validation
        if (isValidIncludes('cancellable', reqBody)) {
            if (!isValid(cancellable)) return res.status(400).send({ status: false, message: 'Please enter cancellable.' });
            if (![true, false].includes(cancellable)) return res.status(400).send({ status: false, message: 'cancellable must be a boolean value.' });
            newData.cancellable = cancellable;
        }
        if (isValidIncludes('status', reqBody)) {
            if (!isValid(status)) return res.status(400).send({ status: false, message: 'Please enter status.' });
            if (!['pending', 'completed', 'canceled'].includes(status)) return res.status(400).send({ status: false, message: 'status must be a pending,completed,canceled.' });
            newData.status = status;
        }

        const orderCreated = await orderModel.create(newData);

        //for product name
        const len = orderCreated.items.length;
        let name = '';
        for (let i = 0; i < len; i++) {
            const x = await productModel.findById(orderCreated.items[i].productId).select({ _id: 0, title: 1 });
            if (len === 1) name += x.title;
            else name += i + 1 + ')' + x.title + ', ';
        };
        name.split('');
        let orderedProduct = '';
        for (let i = 0; i < name.length - 2; i++) {
            orderedProduct += name[i]
        };

        //after completing order, everything is empty.
        existCart.items = []; existCart.totalItems = 0; existCart.totalPrice = 0; existCart.save();

        return res.status(201).send({ status: true, message: `'${orderedProduct}'- product ordered successfully.`, data: orderCreated });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ status: false, error: err.message });
    }
};

//updateOrder
const updateOrder = async (req, res) => {
    try {
        const reqBody = req.body;
        const userId = req.params.userId;
        const { orderId, status } = reqBody;
        if (!isValidBody(reqBody)) return res.status(400).send({ status: false, message: 'No data to update.' });

        if (!userId) return res.status(400).send({ status: false, message: 'Give userId in the Params.' });
        if (!orderId) return res.status(400).send({ status: false, message: 'Please Enter orderId.' });

        if (!isValidObjectId(userId)) return res.status(400).send({ status: false, message: 'Invalid UserId.' });
        if (!isValidObjectId(orderId)) return res.status(400).send({ status: false, message: 'Invalid orderId.' });

        //existCart
        const existCart = await cartModel.findOne({ userId });
        if (!existCart) return res.status(404).send({ status: false, message: 'There is no cart with these user.' });

        //existOrder
        const existOrder = await orderModel.findOne({ _id: orderId, userId });
        if (!existOrder) return res.status(404).send({ status: false, message: 'No such order from this user.' });
        if (existOrder.isDeleted == true) return res.status(400).send({ status: false, message: 'This Order is already deleted.' });

        if (existOrder.status === 'completed') return res.status(400).send({ status: false, message: 'This Order completed can not be cancelled.' });
        if (existOrder.status === 'canceled') return res.status(400).send({ status: false, message: 'This Order is already cancelled.' });

        if (status) {
            if (!isValid(status)) return res.status(400).send({ status: false, message: 'Please Enter status' });
            if (!['pending', 'completed', 'canceled'].includes(status)) return res.status(400).send({ status: false, message: 'Status can only be pending , completed , canceled ' });
        }
        if (status == 'completed' || status == 'canceled') {
            if (existOrder.cancellable == false && status == 'completed') return res.status(400).send({ status: false, message: 'This order is cannot Cancel ' });
        }

        //existCart
        const existUser = await userModel.findById(userId);

        const updateOrder = await orderModel.findOneAndUpdate({ _id: orderId }, { $set: reqBody }, { new: true });
        return res.status(200).send({ status: true, message: `'${existUser.fname} ${existUser.lname}'- your order created successfully.`, Data: updateOrder });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ status: false, error: err.message });
    }
};

module.exports = { createOrder, updateOrder };
