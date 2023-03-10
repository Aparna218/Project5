const userModel = require('../models/userModel');
const { uploadFile } = require('../aws/aws-s3');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { isValidBody, isValidName, isValidEmail, isValidFile, isValidNumber, isValidPass, isValidAddress, isValidPin, isValidObjectId } = require('../util/validator');

//createUser
const createUser = async (req, res) => {
    try {
        const reqBody = req.body;
        const file = req.files;
        const { fname, lname, email, phone, password, address } = reqBody;

        if (!isValidBody(reqBody)) return res.status(400).send({ status: false, message: `Please provide user details.` })
        if (file === undefined || !file.length) return res.status(400).send({ status: false, message: `Please provide user profileImage.` })
        if (!isValidFile(file[0].originalname)) return res.status(400).send({ status: false, message: `Enter formate jpeg/jpg/png only.` })

        if (!fname) return res.status(400).send({ status: false, message: `fname is required.` });
        if (!lname) return res.status(400).send({ status: false, message: `lname is required.` });
        if (!email) return res.status(400).send({ status: false, message: `email is required.` });
        if (!phone) return res.status(400).send({ status: false, message: `phone is required.` });
        if (!password) return res.status(400).send({ status: false, message: `password is required.` });
        if (!address) return res.status(400).send({ status: false, message: `address is required.` });

        if (!isValidName(fname)) return res.status(400).send({ status: false, message: ` '${fname}' this fname is not valid.` });
        if (!isValidName(lname)) return res.status(400).send({ status: false, message: ` '${lname}' this lname is not valid.` });
        if (!isValidEmail(email)) return res.status(400).send({ status: false, message: ` '${email}' this email is not valid email.` });
        if (!isValidNumber(phone)) return res.status(400).send({ status: false, message: ` '${phone}' this is not valid indian phone number.` });
        if (!isValidPass(password)) return res.status(400).send({ status: false, message: `Use this combination 8-15 char & use 0-9,A-Z,a-z & special char.` });

        //address validation
        try { reqBody.address = JSON.parse(address) }
        catch (err) { if (err) return res.status(400).send({ status: false, message: `Please write address properly.` }) };
        const { shipping, billing } = reqBody.address;

        //shipping validation
        if (!shipping) return res.status(400).send({ status: false, message: `shipping is required.` });
        if (!shipping.street) return res.status(400).send({ status: false, message: `street is required in shipping.` })
        if (!shipping.city) return res.status(400).send({ status: false, message: `city is required in shipping.` });
        if (!shipping.pincode) return res.status(400).send({ status: false, message: `pincode is required in shipping.` });

        if (!isValidAddress(shipping.street)) return res.status(400).send({ status: false, message: ` '${shipping.street}' street is not valid in shipping.` })
        if (!isValidAddress(shipping.city)) return res.status(400).send({ status: false, message: ` '${shipping.city}' city is not valid in shipping.` })
        if (!isValidPin(shipping.pincode)) return res.status(400).send({ status: false, message: ` '${shipping.pincode}' pincode is not valid in shipping.` })


        //billing validation
        if (!billing) return res.status(400).send({ status: false, message: `billing is required.` })
        if (!billing.street) return res.status(400).send({ status: false, message: `street is required in billing.` })
        if (!billing.city) return res.status(400).send({ status: false, message: `city is required in billing.` });
        if (!billing.pincode) return res.status(400).send({ status: false, message: `pincode is required in billing.` });

        if (!isValidAddress(billing.street)) return res.status(400).send({ status: false, message: ` '${billing.street}' street is not valid in billing.` })
        if (!isValidAddress(billing.city)) return res.status(400).send({ status: false, message: ` '${billing.city}' city is not valid in billing.` })
        if (!isValidPin(billing.pincode)) return res.status(400).send({ status: false, message: ` '${billing.pincode}' pincode is not valid in billing.` })

        //existing email & phone
        const duplicateEmail = await userModel.findOne({ email });
        if (duplicateEmail) return res.status(400).send({ status: false, message: `Email already exits.` });
        const duplicatePhone = await userModel.findOne({ phone });
        if (duplicatePhone) return res.status(400).send({ status: false, message: `Phone no already exits.` });

        //file uploading on aws
        reqBody['profileImage'] = await uploadFile(file[0]);
        //password hashing
        reqBody['password'] = await bcrypt.hash(password, 10);

        //user creation
        const savedData = await userModel.create(reqBody);
        return res.status(201).send({ status: true, message: `'${fname} ${lname}'- user created successfully!!`, data: savedData });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ status: false, error: err.message });
    }
};


//login
const login = async (req, res) => {
    try {
        const reqBody = req.body;
        const { email, password } = reqBody;

        if (!isValidBody(reqBody)) return res.status(400).send({ status: false, message: `Please fill the data.` })
        if (!email) return res.status(400).send({ status: false, message: `email is required.` });
        if (!password) return res.status(400).send({ status: false, message: `Password is required.` });

        if (!isValidEmail(email)) return res.status(400).send({ status: false, message: ` '${email}' this email is not valid.` });
        if (!isValidPass(password)) return res.status(400).send({ status: false, message: `Password should be 8-15 char & use 0-9,A-Z,a-z & special char this combination.` });

        //existUser
        const existUser = await userModel.findOne({ email });
        if (!existUser) return res.status(404).send({ status: false, message: 'Please register first.' });

        //decoding hash password
        const matchPass = await bcrypt.compare(password, existUser.password);
        if (!matchPass) return res.status(401).send({ status: false, message: 'Wrong password.' })

        //token generation
        const payload = { userId: existUser._id, iat: Math.floor(Date.now() / 1000) };
        const token = jwt.sign(payload, 'group34', { expiresIn: '365d' });

        return res.status(200).send({ status: true, message: 'Login Successful.', data: { userId: existUser._id, token: token } });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ status: false, error: err.message });
    }
};


//gateUser
const gateUser = async (req, res) => {
    try {
        const userId = req.params.userId;
        if (!userId) return res.status(400).send({ status: false, message: 'userId is required on the param.' });
        if (!isValidObjectId(userId)) return res.status(400).send({ status: false, message: `'${userId}' this userId invalid.` });

        const existUser = await userModel.findById(userId)
        if (!existUser) return res.status(400).send({ status: false, message: `User not found by '${userId}' this userId.` });

        return res.status(200).send({ status: true, message: `Success`, data: existUser });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ status: false, error: err.message });
    }
};

//updateUser
const updateUser = async (req, res) => {
    try {
        const reqBody = req.body;
        const file = req.files
        const userId = req.params.userId;
        let { fname, lname, email, phone, password, address } = reqBody;

        let obj = {}

        if (!isValidBody(reqBody) && !file) return res.status(400).send({ status: false, message: `Enter data for update.` })

        if (fname) {
            if (!isValidName(fname)) return res.status(400).send({ status: false, message: ` '${fname}' this fname is not valid.` });
            obj['fname'] = fname;
        }
        if (lname) {
            if (!isValidName(lname)) return res.status(400).send({ status: false, message: ` '${lname}' this lname is not valid.` });
            obj['lname'] = lname;
        }
        if (email)
            if (!isValidEmail(email)) return res.status(400).send({ status: false, message: ` '${email}' this email is not valid.` });

        if (phone)
            if (!isValidNumber(phone)) return res.status(400).send({ status: false, message: ` '${phone}' this phone is not valid.` });

        if (password)
            if (!isValidPass(password)) return res.status(400).send({ status: false, message: `Use this combination 8-15 char & use 0-9,A-Z,a-z & special char.` });

        //address validation
        if (address) {
            try { address = JSON.parse(address) }
            catch (err) { if (err) return res.status(400).send({ status: false, message: `Please enter the address in right format.` }) };

            const { shipping, billing } = address;

            //shipping validation
            if (shipping) {
                const { street, city, pincode } = shipping;

                if ('street' in shipping) {
                    if (!isValidAddress(street)) return res.status(400).send({ status: false, message: ` '${street}' street is not valid in shipping.` })
                    obj['address.shipping.street'] = street;
                }
                if ('city' in shipping) {
                    if (!isValidAddress(city)) return res.status(400).send({ status: false, message: ` '${city}' city is not valid in shipping.` })
                    obj['address.shipping.city'] = city;
                }
                if ('pincode' in shipping) {
                    if (!isValidPin(pincode)) return res.status(400).send({ status: false, message: ` '${pincode}' pincode is not valid in shipping.` })
                    obj['address.shipping.pincode'] = pincode;
                }
            }
            //billing validation
            if (billing) {
                const { street, city, pincode } = billing;

                if ('street' in billing) {
                    if (!isValidAddress(street)) return res.status(400).send({ status: false, message: ` '${street}' street is not valid in billing.` })
                    obj['address.billing.street'] = street;
                }

                if ('city' in billing) {
                    if (!isValidAddress(city)) return res.status(400).send({ status: false, message: ` '${city}' city is not valid in billing.` })
                    obj['address.billing.city'] = city;
                }

                if ('pincode' in billing) {
                    if (!isValidPin(pincode)) return res.status(400).send({ status: false, message: ` '${pincode}' pincode is not valid in billing.` })
                    obj['address.billing.pincode'] = pincode;
                }
            }
        };

        //finding user
        const existUser = await userModel.findById({ _id: userId });
        if (!existUser) return res.status(404).send({ status: false, message: `No user found by '${userId}' this userId.` });

        if (email) {
            const existEmail = await userModel.findOne({ email });
            if (existEmail === null) obj['email'] = email;
            else if (existEmail.email === email) return res.status(400).send({ status: false, message: `Please enter different email.` });
        }
        if (phone) {
            const existPhone = await userModel.findOne({ phone });
            if (existPhone === null) obj['phone'] = phone;
            else if (existPhone.phone === phone) return res.status(400).send({ status: false, message: `Please enter different phone.` });
        }
        if (password) {
            const matchPass = await bcrypt.compare(password, existUser.password);
            if (matchPass === true) return res.status(400).send({ status: false, message: `Please enter new password.` });
            const hashPassword = await bcrypt.hash(password, 10);
            obj['password'] = hashPassword;
        }
        if (file.length > 0) {
            if (!isValidFile(file[0].originalname)) return res.status(400).send({ status: false, message: `Enter formate jpeg/jpg/png only.` });
            const uploadedFileUrl = await uploadFile(file[0]);
            obj['profileImage'] = uploadedFileUrl;
        }

        //updation
        const saveData = await userModel.findOneAndUpdate({ _id: userId }, obj, { new: true });
        return res.status(200).send({ status: true, message: `'${Object.keys(obj)}'- updated successfully.`, data: saveData });
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ status: false, error: err.message });
    }
};

module.exports = { createUser, login, gateUser, updateUser };
