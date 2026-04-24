export const generateRM = (lastNumber) => {
  const nextNumber = parseInt(lastNumber) + 1;
  return nextNumber.toString().padStart(6, '0');
};

export const formatCurrency = (number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(number);
};