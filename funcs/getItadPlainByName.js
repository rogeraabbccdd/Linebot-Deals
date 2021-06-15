module.exports = (data, name) => data.filter((item) => item.title.trim().toUpperCase() === name.trim().toUpperCase())
