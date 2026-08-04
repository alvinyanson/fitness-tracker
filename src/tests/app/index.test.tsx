import { render } from '@testing-library/react-native';
import PairingScreen from '@/app/index';

describe('PairingScreen', () => {
  it('renders title and navigation links', async () => {
    const { getByText } = await render(<PairingScreen />);

    expect(getByText('Pairing')).toBeTruthy();
    expect(getByText('Go to Workout')).toBeTruthy();
    expect(getByText('Go to History')).toBeTruthy();
  });
});
